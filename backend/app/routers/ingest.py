from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.security import get_current_user
from app.core.database import get_supabase_admin
from app.services.ocr_service import process_bill
from app.services.kyc_service import fuzzy_name_match
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
NAME_MATCH_THRESHOLD = 0.80
UTILITY_BILL_VERIFICATION_BONUS = 25


def normalize_ocr_fields(fields):
    if not fields:
        return []

    normalized = []

    if isinstance(fields, dict):
        for key, value in fields.items():
            if isinstance(value, dict):
                normalized.append({
                    "field_name": key,
                    "extracted_value": value.get("extracted_value") or value.get("value"),
                    "confidence": float(value.get("confidence", 0.0) or 0.0),
                    "user_verified": bool(value.get("user_verified", False)),
                })
            else:
                normalized.append({
                    "field_name": key,
                    "extracted_value": value,
                    "confidence": 0.0,
                    "user_verified": False,
                })
        return normalized

    if isinstance(fields, list):
        for index, field in enumerate(fields):
            if isinstance(field, str):
                normalized.append({
                    "field_name": f"field_{index + 1}",
                    "extracted_value": field,
                    "confidence": 0.0,
                    "user_verified": False,
                })
                continue

            if isinstance(field, dict):
                normalized.append({
                    "field_name": (
                        field.get("field_name")
                        or field.get("name")
                        or field.get("key")
                        or field.get("label")
                        or f"field_{index + 1}"
                    ),
                    "extracted_value": (
                        field.get("extracted_value")
                        if field.get("extracted_value") is not None
                        else field.get("value")
                        if field.get("value") is not None
                        else field.get("text")
                        if field.get("text") is not None
                        else field.get("result")
                    ),
                    "confidence": float(field.get("confidence", 0.0) or 0.0),
                    "user_verified": bool(field.get("user_verified", False)),
                })

        return normalized

    return []


def extract_raw_text(ocr_result: dict) -> str:
    possible_keys = [
        "raw_text",
        "ocr_text",
        "text",
        "raw",
        "full_text",
        "extracted_text",
    ]

    for key in possible_keys:
        value = ocr_result.get(key)
        if isinstance(value, str) and value.strip():
            return value

    return ""


def extract_bill_name(fields):
    """
    Try to find the account holder / customer name from OCR fields.
    """
    possible_name_keys = {
        "account_holder",
        "customer_name",
        "account_name",
        "name",
        "consumer_name",
        "subscriber_name",
        "billing_name",
    }

    for field in fields:
        field_name = (field.get("field_name") or "").strip().lower()
        extracted_value = field.get("extracted_value")

        if field_name in possible_name_keys and extracted_value:
            return str(extracted_value).strip()

    return ""


@router.post("/utility-bill")
async def upload_utility_bill(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    filename = file.filename.lower()

    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()

    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail="File too large. Maximum size is 10MB"
        )

    db = get_supabase_admin()

    bill_id = str(uuid.uuid4())
    storage_path = f"bills/{user_id}/{bill_id}.pdf"

    try:
        db.storage.from_("bills").upload(storage_path, pdf_bytes)
    except Exception as e:
        print("Storage upload warning:", e)

    try:
        ocr_result = process_bill(pdf_bytes) or {}
    except Exception as e:
        print("OCR processing error:", e)
        raise HTTPException(status_code=500, detail="OCR processing failed")

    fields = normalize_ocr_fields(ocr_result.get("fields", []))
    raw_text = extract_raw_text(ocr_result)

    biller_detected = (
        ocr_result.get("biller_detected")
        or ocr_result.get("biller")
        or ocr_result.get("provider")
        or "Unknown"
    )

    overall_confidence = float(ocr_result.get("overall_confidence", 0.0) or 0.0)

    status = ocr_result.get("status")
    if not status:
        status = "low_confidence" if overall_confidence < 0.5 else "clean"

    user_data = db.table("users").select("full_name").eq("id", user_id).execute()
    registered_name = user_data.data[0].get("full_name", "") if user_data.data else ""

    bill_name = extract_bill_name(fields)

    identity_match_score = 0.0
    if registered_name and bill_name:
        identity_match_score = fuzzy_name_match(registered_name, bill_name)
    else:
        identity_match_score = 0.0

    if identity_match_score >= NAME_MATCH_THRESHOLD:
        review_status = "verified"
    else:
        review_status = "needs_staff_review"

    db.table("pending_bills").upsert({
        "id": bill_id,
        "user_id": user_id,
        "storage_path": storage_path,
        "biller_detected": biller_detected,
        "fields": fields,
        "overall_confidence": overall_confidence,
        "identity_match_score": identity_match_score,
        "payment_on_time": ocr_result.get("payment_on_time"),
        "status": review_status,
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    # PROFILE VERIFICATION SCORE UPDATE
    user_row = db.table("users") \
        .select(
            "profile_verification_score, utility_bill_verified, utility_bill_review_status"
        ) \
        .eq("id", user_id) \
        .execute()

    new_score = 0

    if user_row.data:
        current_score = user_row.data[0].get("profile_verification_score") or 0
        already_verified = user_row.data[0].get("utility_bill_verified") or False

        # CASE 1: name matches -> verified -> give score bonus only once
        if review_status == "verified":
            if not already_verified:
                new_score = min(current_score + UTILITY_BILL_VERIFICATION_BONUS, 100)
            else:
                new_score = current_score

            db.table("users").update({
                "profile_verification_score": new_score,
                "utility_bill_verified": True,
                "utility_bill_review_status": "verified",
                "utility_bill_name_match_score": round(identity_match_score, 2),
            }).eq("id", user_id).execute()

        # CASE 2: mismatch -> staff review -> no full verification bonus
        else:
            new_score = current_score

            db.table("users").update({
                "utility_bill_verified": False,
                "utility_bill_review_status": "needs_staff_review",
                "utility_bill_name_match_score": round(identity_match_score, 2),
            }).eq("id", user_id).execute()

    return {
        "bill_id": bill_id,
        "biller_detected": biller_detected,
        "fields": fields,
        "overall_confidence": overall_confidence,
        "identity_match_score": round(identity_match_score, 2),
        "payment_on_time": ocr_result.get("payment_on_time"),
        "status": review_status,
        "raw_text": raw_text,
        "has_raw_text": bool(raw_text),
        "bill_name": bill_name,
        "registered_name": registered_name,
        "profile_verification_score": new_score,
    }
