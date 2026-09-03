# ─── Stage 1: Build React Frontend ─────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Unified Production Image ─────────────────────
FROM python:3.13-slim

# Install system runtime dependencies, ffmpeg, nginx, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    ffmpeg \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-warm ChromaDB default embedding model cache
RUN python -c "from chromadb.utils.embedding_functions import DefaultEmbeddingFunction; DefaultEmbeddingFunction()(['warmup'])" || true

# Copy backend source
COPY backend/ ./backend

# Copy built frontend assets to Nginx html directory
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy unified nginx configuration & start script
COPY docker/nginx-unified.conf /etc/nginx/sites-available/default
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Environment variables
ENV CCTV_API_KEY=2006A
ENV PORT=7860
EXPOSE 7860

CMD ["/app/start.sh"]
