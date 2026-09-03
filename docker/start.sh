#!/bin/bash
set -e

# Substitute PORT if provided by cloud hosting (e.g. Render / Cloud Run / Hugging Face)
PORT="${PORT:-7860}"
echo "Configuring OmniSight VLM on port ${PORT}..."
sed -i "s/7860/${PORT}/g" /etc/nginx/sites-available/default 2>/dev/null || true

# Start Nginx in background
nginx

echo "Starting OmniSight VLM Backend on 127.0.0.1:8000..."
cd /app/backend
exec uvicorn app.main:app --host 127.0.0.1 --port 8000
