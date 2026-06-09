from fastapi import APIRouter, HTTPException, status
from app.models.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.database import get_supabase_admin
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    db = get_supabase_admin()

    # Check if email already exists
    existing = db.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    settl_id = f"STL-2025-{user_id[:6].upper()}"

    db.table("users").insert({
        "id": user_id,
        "settl_id": settl_id,
        "email": body.email,
        "full_name": body.full_name,
        "password_hash": hash_password(body.password),
        "kyc_verified": False,
        "otp_verified": False,
        "connected_source_count": 0,
        "identity_consistency_score": 0.5,
        "fraud_flag_count": 0,
    }).execute()

    token = create_access_token({"sub": user_id, "email": body.email}, role="user")
    return TokenResponse(access_token=token, user_id=user_id, role="user")


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_supabase_admin()

    result = db.table("users").select("*").eq("email", body.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = result.data[0]
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user["id"], "email": user["email"]}, role="user")
    return TokenResponse(access_token=token, user_id=user["id"], role="user")


@router.post("/lender/login", response_model=TokenResponse)
async def lender_login(body: LoginRequest):
    """Separate login for lender portal — issues lender-scoped JWT."""
    db = get_supabase_admin()

    result = db.table("lenders").select("*").eq("email", body.email).execute()
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
