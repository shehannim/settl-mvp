"""Deprecated entrypoint — thin shim to avoid divergent app definitions.

Canonical app lives in app.main:app (see backend/app/main.py).
Keeping this file only so `uvicorn main:app` / Railway-style commands keep working.
"""
from dotenv import load_dotenv

load_dotenv()

from app.main import app  # noqa: F401  (re-export canonical FastAPI app)
