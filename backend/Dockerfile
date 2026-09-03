FROM python:3.13-slim

WORKDIR /app

# Install system dependencies (needed for OpenCV headless, building chromadb, etc)
RUN apt-get update && apt-get install -y \
    build-essential \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-cache Chroma ONNX embedding model to eliminate runtime download delays
RUN python -c "from chromadb.utils.embedding_functions import DefaultEmbeddingFunction; DefaultEmbeddingFunction()(['warmup'])" || true

# Copy application source
COPY . .

# Expose backend port
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
