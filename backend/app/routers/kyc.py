from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import NICVerifyRequest, OTPVerifyRequest, KYCStatusResponse
from app.core.security import get_current_user
from app.core.database import get_supabase_admin
from app.services.kyc_service import validate_nic, generate_otp, verify_otp
from datetime import datetime

router = APIRouter(prefix="/api/kyc", tags=["kyc"])


@router.post("/verify-nic")
async def verify_nic(body: NICVerifyRequest, user: dict = Depends(get_current_user)):
    """Validates NIC format and triggers OTP to the user's registered mobile number."""
    user_id = user["sub"]

    # Validate NIC format
    is_valid, error_msg = validate_nic(body.nic_number)
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)

    # Store NIC on user profile
    db = get_supabase_admin()
    db.table("users").update({
        "nic_number": body.nic_number.upper().strip(),
        "nic_validated_at": datetime.utcnow().isoformat(),
    }).eq("id", user_id).execute()

    # Generate and send OTP (demo: always 123456)
    otp = generate_otp(user_id)

    # In production: call Dialog/Mobitel SMS API here
    # await send_sms(user_phone, f"Your Settl verification code is: {otp}")

    return {
        "success": True,
        "message": "Verification code sent to your registered mobile number.",
        "demo_note": "Demo mode: use code 123456",
        "masked_phone": "••• 4521",  # would be real masked phone in production
    }


@router.post("/verify-otp")
async def verify_otp_endpoint(body: OTPVerifyRequest, user: dict = Depends(get_current_user)):
    """Verifies the OTP and marks identity as confirmed."""
    user_id = user["sub"]

    is_valid, error_msg = verify_otp(user_id, body.otp_code)
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)

    # Mark KYC as complete
    db = get_supabase_admin()
    db.table("users").update({
        "otp_verified": True,
        "kyc_verified": True,
        "kyc_completed_at": datetime.utcnow().isoformat(),
    }).eq("id", user_id).execute()

    return {
        "success": True,
        "message": "Identity verified successfully.",
        "kyc_status": {
            "nic_verified": True,
            "otp_verified": True,
            "identity_confirmed": True,
            "verified_at": datetime.utcnow().isoformat(),
        }
    }


@router.get("/status", response_model=KYCStatusResponse)
async def get_kyc_status(user: dict = Depends(get_current_user)):
    """Returns the current KYC status for the authenticated user."""
    user_id = user["sub"]
    db = get_supabase_admin()

    result = db.table("users").select(
        "kyc_verified, otp_verified, kyc_completed_at"
    ).eq("id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    u = result.data[0]
    return KYCStatusResponse(
        nic_verified=bool(u.get("kyc_verified")),
        otp_verified=bool(u.get("otp_verified")),
        identity_confirmed=bool(u.get("kyc_verified") and u.get("otp_verified")),
        verified_at=u.get("kyc_completed_at"),
    )
