from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # JWT
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # PayPal
    PAYPAL_CLIENT_ID: str = ""
    PAYPAL_CLIENT_SECRET: str = ""
    PAYPAL_REDIRECT_URI: str = "http://localhost:8000/api/connect/paypal/callback"
    PAYPAL_BASE_URL: str = "https://api-m.sandbox.paypal.com"

    # Stripe
    STRIPE_CLIENT_ID: str = ""
    STRIPE_SECRET_KEY: str = ""
    STRIPE_REDIRECT_URI: str = ""

    # Exchange rate
    EXCHANGE_RATE_API_KEY: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
