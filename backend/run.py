#!/usr/bin/env python3
"""
Entrypoint for the CCTV Search backend server.
Usage: python run.py
"""
import uvicorn

if __name__ == "__main__":
    print("\n🔍 CCTV Semantic Search Engine v2.0")
    print("   Backend: http://localhost:8000")
    print("   API Docs: http://localhost:8000/docs\n")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
