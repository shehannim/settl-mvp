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

# ✅ ✅ ✅ FINAL CORS CONFIG (IMPORTANT)

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",

    # ✅ YOUR VERCEL FRONTEND URL (VERY IMPORTANT)
    "https://settl-aizqgj87-shehan-nimsara-s-projects.vercel.app",
]

# ✅ If you use env variable (optional)
if settings.FRONTEND_URL and settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)

logger.info(f"Allowed CORS origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,   # ✅ specific origins ONLY
    allow_credentials=True,          # ✅ safe now
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