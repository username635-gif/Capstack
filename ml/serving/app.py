"""
FastAPI model serving endpoint for PD (Probability of Default) predictions.

WHAT THIS SERVICE DOES:
  Serves a trained XGBoost model that predicts the probability a borrower will
  default on their loan. The output feeds directly into underwriting decisions
  in the workers service (apps/workers/src/inngest/functions/underwrite.ts).

ENDPOINTS:
  POST /predict  — given borrower features, returns PD score + SHAP explanations
  GET  /health   — liveness probe (used by Docker/K8s health checks)

MODEL FILE:
  The model is loaded from pd_model.joblib in the same directory.
  When no model file exists (e.g. in development before training runs),
  the service falls back to a deterministic mock formula so the API still
  returns sensible values without crashing.

  To train and save the model:
    cd ml/training && python train.py
  This writes pd_model.joblib to ml/serving/.

SHAP EXPLANATIONS:
  Each prediction includes per-feature SHAP values — these tell you HOW MUCH
  each feature contributed to the final PD score. Positive = pushed PD up
  (higher risk), negative = pushed PD down (lower risk). Used in the Ops
  dashboard to show credit officers why a loan was approved or declined.

MOCK FORMULA (when no model file is present):
  mock_pd = dti * 0.6 + (1 - bureau_score / 850) * 0.4
  This is a reasonable linear approximation: DTI is the strongest predictor,
  bureau score is the second. The real model will outperform this significantly.

PATTERNS APPLIED:
  1. Early return  — validate input schema with Pydantic (raises 422 automatically)
  6. Async helpers — async endpoints
  7. Shorthand     — dict unpacking for response
  8. Composition   — load → predict → explain pipeline
"""

from fastapi import FastAPI
from pydantic import BaseModel, Field
import joblib
import shap
import numpy as np
from pathlib import Path

# ── App + model loading ───────────────────────────────────────────────────────

app = FastAPI(title="Capstack ML Serving", version="1.0.0")

MODEL_PATH = Path(__file__).parent / "pd_model.joblib"

try:
    model     = joblib.load(MODEL_PATH)
    explainer = shap.TreeExplainer(model)
    _model_ready = True
except FileNotFoundError:
    _model_ready = False
    model, explainer = None, None

FEATURES = ["income", "dti", "overdraft_count", "bureau_score", "employment_months"]

# ── Schemas ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    income:            float = Field(..., gt=0,     description="Monthly income in ZAR")
    dti:               float = Field(..., ge=0, le=1, description="Debt-to-income ratio 0–1")
    overdraft_count:   int   = Field(..., ge=0,     description="Number of overdrafts in 12 months")
    bureau_score:      float = Field(650, ge=100, le=850, description="Credit bureau score")
    employment_months: int   = Field(12,  ge=0,           description="Months in current employment")

class PredictResponse(BaseModel):
    pd:   float                  # Probability of default
    band: str                    # Risk band A–E
    shap: dict[str, float]       # Per-feature SHAP contributions

# ── Helpers — pattern 8 pipeline ──────────────────────────────────────────────

def _to_array(req: PredictRequest) -> np.ndarray:
    return np.array([[req.income, req.dti, req.overdraft_count, req.bureau_score, req.employment_months]])

# Risk band classification: maps PD score to a letter band A–E.
# These bands must match the APR_BY_BAND table in packages/pricing/src/pricing.ts
# so that the same borrower gets the correct interest rate.
# Example: PD of 0.03 (3%) → band B → 12% APR
def _classify_band(pd_score: float) -> str:
    # Pattern 2 (Python equivalent: conditional expression chain)
    return (
        "A" if pd_score < 0.02 else
        "B" if pd_score < 0.05 else
        "C" if pd_score < 0.10 else
        "D" if pd_score < 0.20 else
        "E"
    )

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model_ready": _model_ready}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    # Pattern 1 — early return with deterministic mock when model not loaded
    if not _model_ready:
        # Deterministic mock: derive PD from DTI and bureau score
        mock_pd   = min(0.99, max(0.01, req.dti * 0.6 + (1 - req.bureau_score / 850) * 0.4))
        mock_band = _classify_band(mock_pd)
        mock_shap = {
            "income":            round(-req.income / 100_000, 4),
            "dti":               round(req.dti * 0.5, 4),
            "overdraft_count":   round(req.overdraft_count * 0.05, 4),
            "bureau_score":      round(-(req.bureau_score - 500) / 1000, 4),
            "employment_months": round(-req.employment_months / 120, 4),
        }
        return PredictResponse(pd=round(mock_pd, 4), band=mock_band, shap=mock_shap)

    X         = _to_array(req)
    pd_score  = float(model.predict_proba(X)[0][1])          # type: ignore[index]
    band      = _classify_band(pd_score)
    shap_vals = explainer.shap_values(X)[0].tolist()          # type: ignore[index]

    # Pattern 7 — dict comprehension (shorthand)
    shap_map  = dict(zip(FEATURES, shap_vals))

    # Pattern 7 — shorthand keys match variable names
    return PredictResponse(pd=pd_score, band=band, shap=shap_map)
