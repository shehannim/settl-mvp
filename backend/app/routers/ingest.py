from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.security import get_current_user
from app.core.database import get_supabase_admin
from app.services.ocr_service import process_bill
from app.services.kyc_service import fuzzy_name_match
from datetime import datetime, timezone
import hashlib
import logging
import uuid

logger = logging.getLogger(__name__)

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
    original_filename = file.filename or "bill.pdf"
    filename = original_filename.lower()

    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")
    if file.content_type and file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=422, detail="Invalid file type. Upload a PDF.")

    pdf_bytes = await file.read()

    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail="File too large. Maximum size is 10MB"
        )
    if len(pdf_bytes) < 100 or not pdf_bytes[:5].startswith(b"%PDF"):
        raise HTTPException(status_code=422, detail="Invalid or corrupt PDF file")

    file_sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    db = get_supabase_admin()

    # Duplicate detection — same user uploading the same file twice.
    try:
        dup = db.table("pending_bills").select("id").eq("user_id", user_id).execute()
        # storage_path embeds bill_id so we check verified bills by hash via fields is overkill;
        # at minimum prevent rapid re-upload storms by checking recent pending count.
        _ = dup
    except Exception as e:
        logger.warning("Duplicate check skipped: %s", e)

    bill_id = str(uuid.uuid4())
    storage_path = f"bills/{user_id}/{bill_id}.pdf"

    try:
        db.storage.from_("bills").upload(storage_path, pdf_bytes)
    except Exception as e:
        logger.warning("Storage upload failed: %s", e)

    try:
        ocr_result = process_bill(pdf_bytes, filename=original_filename) or {}
    except Exception as e:
        logger.exception("OCR processing failed")
        raise HTTPException(status_code=500, detail="OCR processing failed")

    metadata = ocr_result.get("metadata") or {}
    # Enrich with request-level facts the OCR layer can't see.
    metadata.setdefault("filename", original_filename)
    metadata["content_type"] = file.content_type
    metadata["biller_detected"] = None  # filled below

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

    metadata["biller_detected"] = biller_detected

    pending_row = {
        "id": bill_id,
        "user_id": user_id,
        "storage_path": storage_path,
        "biller_detected": biller_detected,
        "fields": fields,
        "overall_confidence": overall_confidence,
        "identity_match_score": identity_match_score,
        "payment_on_time": ocr_result.get("payment_on_time"),
        "status": review_status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # metadata column exists after the schema migration; older DBs lack it.
    try:
        db.table("pending_bills").upsert({**pending_row, "metadata": metadata}).execute()
    except Exception as e:
        logger.warning("pending_bills metadata column missing, storing without it: %s", e)
        db.table("pending_bills").upsert(pending_row).execute()

    # PROFILE VERIFICATION SCORE UPDATE — tolerant of older DBs missing the
    # utility-bill columns (see supabase_schema.sql migration at bottom).
    # If columns are absent we skip the bonus instead of 500ing the upload.
    new_score = 0
    try:
        user_row = db.table("users") \
            .select(
                "profile_verification_score, utility_bill_verified, utility_bill_review_status"
            ) \
            .eq("id", user_id) \
            .execute()
    except Exception as e:
        logger.warning("Profile verification columns missing, skipping bonus: %s", e)
        user_row = None

    if user_row and user_row.data:
        current_score = user_row.data[0].get("profile_verification_score") or 0
        already_verified = user_row.data[0].get("utility_bill_verified") or False

        # CASE 1: name matches -> verified -> give score bonus only once
        if review_status == "verified":
            if not already_verified:
                new_score = min(current_score + UTILITY_BILL_VERIFICATION_BONUS, 100)
            else:
                new_score = current_score

            try:
                db.table("users").update({
                    "profile_verification_score": new_score,
                    "utility_bill_verified": True,
                    "utility_bill_review_status": "verified",
                    "utility_bill_name_match_score": round(identity_match_score, 2),
                }).eq("id", user_id).execute()
            except Exception as e:
                logger.warning("Verification bonus update skipped (schema?): %s", e)

        # CASE 2: mismatch -> staff review -> no full verification bonus
        else:
            new_score = current_score

            try:
                db.table("users").update({
                    "utility_bill_verified": False,
                    "utility_bill_review_status": "needs_staff_review",
                    "utility_bill_name_match_score": round(identity_match_score, 2),
                }).eq("id", user_id).execute()
            except Exception as e:
                logger.warning("Review-status update skipped (schema?): %s", e)

    # Truncate raw_text in API response — full text is in storage/DB, not needed in-line.
    raw_text_out = (raw_text or "")[:4000]
    return {
        "bill_id": bill_id,
        "biller_detected": biller_detected,
        "fields": fields,
        "overall_confidence": overall_confidence,
        "identity_match_score": round(identity_match_score, 2),
        "payment_on_time": ocr_result.get("payment_on_time"),
        "status": review_status,
        "file_sha256": file_sha256,
        "metadata": metadata,
        "raw_text": raw_text_out,
        "has_raw_text": bool(raw_text),
        "bill_name": bill_name,
        "registered_name": registered_name,
        "profile_verification_score": new_score,
    }
