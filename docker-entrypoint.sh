#!/bin/sh
# ─── Entrypoint for ML service ────────────────────────────────────────────────
# Trains models on first boot if they don't exist, then starts FastAPI.

cd /app/ml || exit 1

MODEL_FILE="models/xgboost_price.pkl"

if [ ! -f "$MODEL_FILE" ]; then
  echo "=== First boot: training models (this takes ~2-3 minutes) ==="
  python property_prediction_model.py train
  echo "=== Training complete ==="
fi

echo "=== Starting prediction API on port 8000 ==="
exec uvicorn property_prediction_model:api \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 2 \
  --log-level info
