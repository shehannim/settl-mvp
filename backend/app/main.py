from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.routers import auth, kyc, connect, ingest, score, lender
from app.services.scoring_service import load_model
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading scoring model...")
    try:
        load_model()
        logger.info("Scoring model loaded successfully.")
    except Exception as e:
        logger.warning(f"Model not loaded: {e}")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Settl API",
    description="Alternative credit intelligence for Sri Lanka's digital economy.",
    version="1.0.0",
    lifespan=lifespan,
)

# ✅ CORS — restrict to configured frontend in production.
# FRONTEND_URL covers local dev (5173) and prod (set via env).
_cors_origins = list({settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"})
if settings.DEMO_RETURN_OTP:
    logger.warning("DEMO_RETURN_OTP is enabled — OTPs will be returned in API responses. Never enable in production.")
if settings.SECRET_KEY == "change-this-in-production":
    logger.warning("SECRET_KEY is using the default value. Set a strong SECRET_KEY in production.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ REGISTER ROUTERS
app.include_router(auth.router)
app.include_router(kyc.router)
app.include_router(connect.router)
app.include_router(ingest.router)
app.include_router(score.router)
app.include_router(lender.router)


@app.get("/")
async def root():
    return {
        "service": "Settl API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    """Dependency health: Supabase reachability + model load state."""
    from app.services.scoring_service import get_model

    checks: dict = {}
    try:
        from app.core.database import get_supabase_admin
        import os
        if not os.getenv("SUPABASE_URL") and not get_settings().SUPABASE_URL:
            checks["database"] = "not_configured"
        else:
            db = get_supabase_admin()
            db.table("users").select("id").limit(1).execute()
            checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:120]}"
    try:
        get_model()
        checks["model"] = "ok"
    except Exception as e:
        checks["model"] = f"not_loaded: {str(e)[:120]}"
    ok = checks.get("database") == "ok" and checks.get("model") == "ok"
    import os as _os
    return {
        "ready": ok,
        "checks": checks,
        # Render injects RENDER_GIT_COMMIT on deploy — lets clients verify
        # which backend revision is actually serving (e.g. metadata support).
        "build": (_os.getenv("RENDER_GIT_COMMIT") or "local")[:12],
    }