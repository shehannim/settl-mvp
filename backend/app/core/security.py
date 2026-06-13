from datetime import datetime, timedelta
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

    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode["exp"] = expire

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


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