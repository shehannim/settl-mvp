from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings

settings = get_settings()

# ✅ Bcrypt context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ✅ Auth scheme
bearer_scheme = HTTPBearer()


# ✅ HASH PASSWORD (SAFE)
def hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])  # truncate to avoid bcrypt limit


# ✅ VERIFY PASSWORD (SAFE + NO CRASH)
def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain[:72], hashed)
    except Exception:
        return False  # ✅ prevents server crash


# ✅ CREATE TOKEN
def create_access_token(
    data: dict,
    role: str = "user",
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()
    to_encode["role"] = role

    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode["exp"] = expire

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def _oauth_secret() -> str:
    return settings.OAUTH_STATE_SECRET or settings.SECRET_KEY


def create_oauth_state(user_id: str) -> str:
    """Stateless signed OAuth state — works across instances. No server store."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.OAUTH_STATE_EXPIRE_MINUTES
    )
    return jwt.encode(
        {"sub": user_id, "exp": expire, "purpose": "paypal_oauth"},
        _oauth_secret(),
        algorithm=settings.ALGORITHM,
    )


def decode_oauth_state(state: str) -> str:
    """Returns user_id or raises 401. No fallback to another user."""
    try:
        payload = jwt.decode(state, _oauth_secret(), algorithms=[settings.ALGORITHM])
    except JWTError:
        from fastapi import HTTPException, status as _status
        raise HTTPException(
            status_code=_status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OAuth state",
        )
    if payload.get("purpose") != "paypal_oauth" or not payload.get("sub"):
        from fastapi import HTTPException, status as _status
        raise HTTPException(
            status_code=_status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OAuth state",
        )
    return payload["sub"]


# ✅ DECODE TOKEN
def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


# ✅ USER AUTH
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> dict:
    payload = decode_token(credentials.credentials)

    if payload.get("role") != "user":
        raise HTTPException(
            status_code=403,
            detail="User access required"
        )

    return payload


# ✅ LENDER AUTH
def get_current_lender(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> dict:
    payload = decode_token(credentials.credentials)

    if payload.get("role") != "lender":
        raise HTTPException(
            status_code=403,
            detail="Lender access required"
        )

    return payload