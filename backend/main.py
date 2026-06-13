from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.routers import auth, kyc, connect, ingest, score, lender
from app.services.scoring_service import load_model
import logging
from app.routers import paypal_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load XGBoost model at startup
    logger.info("Loading scoring model...")
    try:
        load_model()
        logger.info("Scoring model loaded successfully.")
    except Exception as e:
        logger.warning(f"Model not loaded: {e}. Run scripts/train_model.py first.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Settl API",
    description="Alternative credit intelligence for Sri Lanka's digital economy.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
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
