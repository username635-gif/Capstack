FROM python:3.12-slim

WORKDIR /app

# Install system deps for XGBoost + SHAP
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy serving code
COPY app.py .
# Copy trained model artefact if present; app falls back to deterministic mock if absent
RUN --mount=type=bind,source=.,target=/build \
    cp /build/pd_model.joblib . 2>/dev/null || true

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
