from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import (
    RegisterRequest, LoginRequest, LenderLoginRequest, TokenResponse,
    GoogleLoginRequest,
)
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.core.database import get_supabase_admin
from app.core.config import get_settings
import base64
import httpx
import json
import logging
import secrets
import time
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _create_user_with_settl_id(db, *, email: str, full_name: str, password_hash: str):
    """Insert a user with collision-retried Settl ID. Returns (user_id, settl_id)."""
    user_id = str(uuid.uuid4())
    year = datetime.now().year
    settl_id = None
    last_error: Exception | None = None
    for _ in range(5):
        candidate = f"STL-{year}-{uuid.uuid4().hex[:6].upper()}"
        try:
            db.table("users").insert({
                "id": user_id,
                "settl_id": candidate,
                "email": email,
                "full_name": full_name.strip(),
                "password_hash": password_hash,
                "kyc_verified": False,
                "otp_verified": False,
                "connected_source_count": 0,
                "identity_consistency_score": 0.5,
                "fraud_flag_count": 0,
            }).execute()
            settl_id = candidate
            break
        except Exception as e:
            last_error = e
            # Only retry unique-violation on settl_id; anything else aborts.
            if "settl_id" not in str(e).lower() and "duplicate" not in str(e).lower() \
                    and "unique" not in str(e).lower():
                raise
    if settl_id is None:
        raise HTTPException(
            status_code=503,
            detail=f"Could not allocate a Settl ID, please retry. ({last_error})",
        )
    return user_id, settl_id


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    db = get_supabase_admin()
    email = body.email.lower().strip()

    # Check if email already exists
    existing = db.table("users").select("id").eq("email", email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id, settl_id = await _create_user_with_settl_id(
        db, email=email, full_name=body.full_name,
        password_hash=hash_password(body.password),
    )

    token = create_access_token({"sub": user_id, "email": email}, role="user")
    return TokenResponse(access_token=token, user_id=user_id, role="user", settl_id=settl_id, email=email)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_supabase_admin()
    email = body.email.lower().strip()

    result = db.table("users").select("*").eq("email", email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = result.data[0]
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user["id"], "email": user["email"]}, role="user")
    return TokenResponse(access_token=token, user_id=user["id"], role="user", settl_id=user.get("settl_id"), email=user.get("email"))


@router.get("/me")
async def get_profile(user: dict = Depends(get_current_user)):
    """Borrower profile: identity + unique Settl ID (shown in-app, given to lenders)."""
    db = get_supabase_admin()
    result = db.table("users").select("id, settl_id, email, full_name, kyc_verified").eq("id", user["sub"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    row = result.data[0]
    return {
        "user_id": row["id"],
        "settl_id": row.get("settl_id"),
        "email": row.get("email"),
        "full_name": row.get("full_name"),
        "kyc_verified": row.get("kyc_verified", False),
    }


@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleLoginRequest):
    """Google sign-in via GIS auth-code flow.

    Frontend sends the one-time `code` from the GIS popup; the secret never
    leaves the backend. We exchange it at Google, verify aud/expiry/email,
    then find-or-create the user and issue OUR JWT (role user).
    """
    settings = get_settings()
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_NOT_CONFIGURED: set GOOGLE_CLIENT_ID/SECRET on the backend.",
        )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": body.code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": "postmessage",
                    "grant_type": "authorization_code",
                },
            )
    except Exception as e:
        logger.warning("Google token exchange transport failed: %s", e)
        raise HTTPException(status_code=502, detail="Google exchange failed")

    if resp.status_code != 200:
        logger.warning("Google token exchange rejected: %s", resp.text[:200])
        raise HTTPException(status_code=401, detail="Invalid Google authorization code")

    id_token = resp.json().get("id_token", "")
    try:
        payload_b64 = id_token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload_b64).decode())
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google identity token")

    # Claims come over a server-to-server TLS exchange authenticated with OUR
    # secret, but still verify audience, expiry and email before trusting.
    if claims.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")
    if int(claims.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="Google token expired")
    if claims.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="Google email not verified")

    email = str(claims.get("email", "")).lower().strip()
    full_name = str(claims.get("name") or "").strip() or email.split("@")[0]
    picture = str(claims.get("picture") or "")
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email")

    db = get_supabase_admin()
    existing = db.table("users").select("id, settl_id, full_name").eq("email", email).execute()
    if existing.data:
        user_id = existing.data[0]["id"]
        settl_id = existing.data[0].get("settl_id")
        stored_name = (existing.data[0].get("full_name") or "").strip()
        display_name = stored_name or full_name
        if not stored_name and full_name:
            # Adopt the verified Google name only when we have none stored.
            try:
                db.table("users").update({"full_name": full_name}).eq("id", user_id).execute()
            except Exception as e:
                logger.warning("Google display-name update failed: %s", e)
    else:
        # Unusable password hash: Google users can never password-login.
        # 256-bit random — infeasible to guess, and login still checks it.
        user_id, settl_id = await _create_user_with_settl_id(
            db, email=email, full_name=full_name,
            password_hash=hash_password(secrets.token_hex(32)),
        )
        display_name = full_name

    token = create_access_token({"sub": user_id, "email": email}, role="user")
    return TokenResponse(access_token=token, user_id=user_id, role="user", settl_id=settl_id, email=email, name=display_name, picture=picture or None)


@router.post("/lender/login", response_model=TokenResponse)
async def lender_login(body: LenderLoginRequest):
    """Separate login for lender portal — issues lender-scoped JWT."""
    db = get_supabase_admin()
    email = body.email.lower().strip()

    result = db.table("lenders").select("*").eq("email", email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid lender credentials")

    lender = result.data[0]
    if not verify_password(body.password, lender["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid lender credentials")

    token = create_access_token(
        {"sub": lender["id"], "email": lender["email"], "institution": lender.get("institution_name", "")},
        role="lender"
    )
    return TokenResponse(access_token=token, user_id=lender["id"], role="lender")
