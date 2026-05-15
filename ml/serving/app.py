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

from fastapi import FastAPI, Header, Query
from pydantic import BaseModel, Field
from typing import Optional
import joblib
import shap
import numpy as np
import os
from pathlib import Path

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Capstack ML Serving", version="2.0.0")

# ── Champion / Challenger deployment ─────────────────────────────────────────
#
# CHAMPION / CHALLENGER PATTERN:
#   Two models run simultaneously. The champion is the production model (used
#   by default). The challenger is a newer candidate model being evaluated.
#
#   Traffic split: set CHALLENGER_TRAFFIC_PCT env var (0–100).
#   Default is 0% (challenger disabled until explicitly enabled).
#
#   Each /predict call records which model was used in the `model_version` field.
#   Compare champion vs challenger AUC in the Ops dashboard to determine when
#   to promote the challenger to champion.
#
#   To promote: set CHAMPION_MODEL_PATH to the challenger's .joblib file and
#   set CHALLENGER_TRAFFIC_PCT back to 0.
#
#   PRODUCTION: replace the traffic split with a proper feature flag (LaunchDarkly,
#   Statsig) so you can canary by partner or risk segment rather than random%.
#
CHAMPION_PATH    = Path(os.getenv("CHAMPION_MODEL_PATH",  str(Path(__file__).parent / "pd_model.joblib")))
CHALLENGER_PATH  = Path(os.getenv("CHALLENGER_MODEL_PATH", str(Path(__file__).parent / "pd_model_challenger.joblib")))
CHALLENGER_PCT   = int(os.getenv("CHALLENGER_TRAFFIC_PCT", "0"))  # 0–100

def _load_model(path: Path):
    """Load a joblib model + build SHAP explainer. Returns (model, explainer, ready)."""
    try:
        m = joblib.load(path)
        e = shap.TreeExplainer(m)
        return m, e, True
    except FileNotFoundError:
        return None, None, False

champion_model,   champion_explainer,   _champion_ready   = _load_model(CHAMPION_PATH)
challenger_model, challenger_explainer, _challenger_ready = _load_model(CHALLENGER_PATH)

FEATURES = ["income", "dti", "overdraft_count", "bureau_score", "employment_months"]

# ── Schemas ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    income:            float = Field(..., gt=0,       description="Monthly income in ZAR")
    dti:               float = Field(..., ge=0, le=1, description="Debt-to-income ratio 0–1")
    overdraft_count:   int   = Field(..., ge=0,       description="Number of overdrafts in 12 months")
    bureau_score:      float = Field(650, ge=100, le=850, description="Credit bureau score")
    employment_months: int   = Field(12,  ge=0,       description="Months in current employment")

class PredictResponse(BaseModel):
    pd:            float               # Probability of default
    band:          str                 # Risk band A–E
    shap:          dict[str, float]    # Per-feature SHAP contributions
    model_version: str                 # 'champion' | 'challenger' — for A/B tracking

# ── Helpers — pattern 8 pipeline ──────────────────────────────────────────────

def _to_array(req: PredictRequest) -> np.ndarray:
    return np.array([[req.income, req.dti, req.overdraft_count, req.bureau_score, req.employment_months]])

def _classify_band(pd_score: float) -> str:
    return (
        "A" if pd_score < 0.02 else
        "B" if pd_score < 0.05 else
        "C" if pd_score < 0.10 else
        "D" if pd_score < 0.20 else
        "E"
    )

def _mock_predict(req: PredictRequest, version: str) -> PredictResponse:
    """Deterministic fallback when no model file is loaded."""
    mock_pd   = min(0.99, max(0.01, req.dti * 0.6 + (1 - req.bureau_score / 850) * 0.4))
    mock_band = _classify_band(mock_pd)
    mock_shap = {
        "income":            round(-req.income / 100_000, 4),
        "dti":               round(req.dti * 0.5, 4),
        "overdraft_count":   round(req.overdraft_count * 0.05, 4),
        "bureau_score":      round(-(req.bureau_score - 500) / 1000, 4),
        "employment_months": round(-req.employment_months / 120, 4),
    }
    return PredictResponse(pd=round(mock_pd, 4), band=mock_band, shap=mock_shap, model_version=version)

def _real_predict(model, explainer, req: PredictRequest, version: str) -> PredictResponse:
    """Run a real model prediction with SHAP explanations."""
    X         = _to_array(req)
    pd_score  = float(model.predict_proba(X)[0][1])
    band      = _classify_band(pd_score)
    shap_vals = explainer.shap_values(X)[0].tolist()
    shap_map  = dict(zip(FEATURES, shap_vals))
    return PredictResponse(pd=pd_score, band=band, shap=shap_map, model_version=version)

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":            "ok",
        "champion_ready":    _champion_ready,
        "challenger_ready":  _challenger_ready,
        "challenger_pct":    CHALLENGER_PCT,
    }

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """
    Score a borrower. Routes to champion or challenger based on CHALLENGER_TRAFFIC_PCT.

    Champion/challenger routing:
      - If challenger is loaded and a random roll falls within CHALLENGER_PCT,
        use the challenger model and tag the response model_version='challenger'.
      - Otherwise use the champion (model_version='champion').
      - If neither model is loaded, fall back to the deterministic mock formula.
    """
    # Pattern 1 — route to challenger if within traffic allocation
    use_challenger = (
        _challenger_ready and
        CHALLENGER_PCT > 0 and
        int(np.random.randint(0, 100)) < CHALLENGER_PCT
    )

    if use_challenger:
        return _real_predict(challenger_model, challenger_explainer, req, "challenger")   # type: ignore[arg-type]

    if _champion_ready:
        return _real_predict(champion_model, champion_explainer, req, "champion")         # type: ignore[arg-type]

    # Neither model loaded — deterministic mock
    return _mock_predict(req, "mock")

@app.get("/models")
def models():
    """List loaded models and their paths. Used by the Ops dashboard."""
    return {
        "champion":   {"path": str(CHAMPION_PATH),   "ready": _champion_ready},
        "challenger": {"path": str(CHALLENGER_PATH),  "ready": _challenger_ready},
        "challenger_traffic_pct": CHALLENGER_PCT,
    }
