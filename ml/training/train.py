"""
PD (Probability of Default) model training script.

Uses synthetic data to train an XGBoost classifier.
In production, replace with real labelled loan data from the database.

Patterns applied (Python equivalents of the 8 TS patterns):
  1. Early return  — validate data before training
  5. List comprehensions / vectorised ops — no manual loops
  8. Composition   — generate → train → explain → save pipeline
"""

import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
import shap
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

RANDOM_STATE = 42
N_SAMPLES    = 5_000
MODEL_PATH   = Path(__file__).parent.parent / "serving" / "pd_model.joblib"

# ── 1. Generate synthetic data ────────────────────────────────────────────────

def generate_data(n: int = N_SAMPLES) -> pd.DataFrame:
    rng = np.random.default_rng(RANDOM_STATE)
    income           = rng.normal(50_000, 20_000, n).clip(min=5_000)
    dti              = rng.uniform(0.05, 0.75, n)
    overdraft_count  = rng.poisson(2, n)
    bureau_score     = rng.normal(650, 80, n).clip(100, 850)
    employment_months = rng.poisson(36, n)

    # Synthetic default label: higher DTI + lower score → higher default probability
    log_odds = -3 + 4 * dti - 0.005 * bureau_score + 0.05 * overdraft_count
    prob     = 1 / (1 + np.exp(-log_odds))
    default  = rng.binomial(1, prob, n)

    return pd.DataFrame({
        "income":            income,
        "dti":               dti,
        "overdraft_count":   overdraft_count,
        "bureau_score":      bureau_score,
        "employment_months": employment_months,
        "default":           default,
    })

FEATURES = ["income", "dti", "overdraft_count", "bureau_score", "employment_months"]

# ── 2. Train ──────────────────────────────────────────────────────────────────

def train(df: pd.DataFrame):
    # Pattern 1 — validate before training
    assert len(df) > 100, "Need at least 100 samples to train"
    assert df["default"].nunique() == 2, "Labels must be binary"

    X, y = df[FEATURES], df["default"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    print(f"[train] AUC: {auc:.4f}")
    return model

# ── 3. Explain ────────────────────────────────────────────────────────────────

def explain(model, X_sample: pd.DataFrame):
    explainer   = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)
    return dict(zip(FEATURES, shap_values[0].tolist()))

# ── 4. Pipeline — pattern 8: compose ─────────────────────────────────────────

if __name__ == "__main__":
    df    = generate_data()
    model = train(df)
    joblib.dump(model, MODEL_PATH)
    print(f"[train] Model saved to {MODEL_PATH}")

    sample  = df[FEATURES].iloc[:1]
    contrib = explain(model, sample)
    print(f"[train] SHAP contributions: {contrib}")
