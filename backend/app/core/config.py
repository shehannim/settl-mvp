from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # JWT
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Google sign-in (GIS auth-code flow; secret stays server-side).
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Email delivery (Resend HTTPS API — Render free blocks SMTP).
    # Unset = OTP endpoints answer 503 instead of pretending to send mail.
    RESEND_API_KEY: str = ""
    RESEND_FROM: str = ""

    # OAuth state signing (falls back to SECRET_KEY)
    OAUTH_STATE_SECRET: str = ""
    OAUTH_STATE_EXPIRE_MINUTES: int = 15

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # PayPal
    PAYPAL_CLIENT_ID: str = ""
    PAYPAL_CLIENT_SECRET: str = ""
    PAYPAL_REDIRECT_URI: str = "http://localhost:8000/api/connect/paypal/callback"
    PAYPAL_BASE_URL: str = "https://api-m.sandbox.paypal.com"

    # LinkedIn Verified (identityMe). Self-serve tiers return name/email/photo;
    # most-recent education needs Plus tier scope r_most_recent_education.
    # Development tier only works for app admins — fine for demo, apply for
    # Lite/Plus for production. Env-tunable scopes/paths like Payoneer.
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_REDIRECT_URI: str = "http://localhost:8000/api/connect/linkedin/callback"
    LINKEDIN_AUTH_URL: str = "https://www.linkedin.com/oauth/v2/authorization"
    LINKEDIN_TOKEN_PATH: str = "/oauth/v2/accessToken"
    LINKEDIN_API_BASE: str = "https://api.linkedin.com"
    LINKEDIN_IDENTITY_PATH: str = "/rest/identityMe"
    LINKEDIN_API_VERSION: str = "202510"
    LINKEDIN_SCOPES: str = "openid profile email"
    # Payoneer (partner OAuth — credentials issued via developer.payoneer.com)
    PAYONEER_CLIENT_ID: str = ""
    PAYONEER_CLIENT_SECRET: str = ""
    PAYONEER_REDIRECT_URI: str = "http://localhost:8000/api/connect/payoneer/callback"
    PAYONEER_BASE_URL: str = "https://api.sandbox.payoneer.com"
    PAYONEER_AUTH_URL: str = "https://login.sandbox.payoneer.com/api/v2/oauth2/authorize"
    # Confirm against the portal's API reference for your program version and
    # override via env if Payoneer assigned different paths/scopes.
    PAYONEER_TOKEN_PATH: str = "/api/v2/oauth2/token"
    PAYONEER_ACCOUNT_PATH: str = "/api/v2/account/details"
    PAYONEER_TX_PATH: str = "/api/v2/account/transactions"
    PAYONEER_SCOPES: str = "openid profile email account:balances:read account:transactions:read"

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
