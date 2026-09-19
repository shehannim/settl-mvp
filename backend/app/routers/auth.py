from fastapi import APIRouter, HTTPException, status
from app.models.schemas import RegisterRequest, LoginRequest, LenderLoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.database import get_supabase_admin
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    db = get_supabase_admin()
    email = body.email.lower().strip()

    # Check if email already exists
    existing = db.table("users").select("id").eq("email", email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    year = datetime.now().year
    password_hash = hash_password(body.password)

    # 6-hex suffix has 16M combinations — collisions are theoretical, but a
    # clash must never 500 a registration. Retry with a fresh suffix.
    settl_id = None
    last_error: Exception | None = None
    for _ in range(5):
        candidate = f"STL-{year}-{uuid.uuid4().hex[:6].upper()}"
        try:
            db.table("users").insert({
                "id": user_id,
                "settl_id": candidate,
                "email": email,
                "full_name": body.full_name.strip(),
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

    token = create_access_token({"sub": user_id, "email": email}, role="user")
    return TokenResponse(access_token=token, user_id=user_id, role="user")


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
    return TokenResponse(access_token=token, user_id=user["id"], role="user")


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
