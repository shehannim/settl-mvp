from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.security import get_current_user
from app.core.database import get_supabase_admin
from app.services.ocr_service import (
    process_bill,
    extract_text_with_provenance,
    clean_text,
    get_pdf_metadata,
    is_payoneer_statement,
    parse_payoneer_statement,
    validate_payment_on_time,
)
from app.models.schemas import OCRReviewRequest
from app.services.normalisation_service import (
    get_usd_to_lkr_rate,
    build_monthly_income_async,
    compute_income_features,
)
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

    # Duplicate detection — TEMPORARY (pre-launch): re-uploads are allowed
    # through and flagged instead of rejected, so testing never blocks.
    # To enforce, replace the flag with: raise HTTPException(409, ...).
    duplicate_of = None
    try:
        dup = db.table("pending_bills").select("id").eq(
            "user_id", user_id).eq("file_sha256", file_sha256).execute()
        if dup.data:
            duplicate_of = dup.data[0]["id"]
            logger.info("Re-upload of bill %s by user %s", duplicate_of, user_id[:8])
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
        "file_sha256": file_sha256,
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # metadata/file_sha256 columns exist after the schema migration; older
    # DBs lack them — strip unknown keys instead of 500ing the upload.
    for _attempt in range(2):
        try:
            db.table("pending_bills").upsert(pending_row).execute()
            break
        except Exception as e:
            if "metadata" in pending_row:
                del pending_row["metadata"]
                logger.warning("pending_bills metadata column missing, retrying: %s", e)
                continue
            if "file_sha256" in pending_row:
                del pending_row["file_sha256"]
                logger.warning("pending_bills file_sha256 column missing, retrying: %s", e)
                continue
            raise

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
        "duplicate_of": duplicate_of,
        "metadata": metadata,
        "raw_text": raw_text_out,
        "has_raw_text": bool(raw_text),
        "bill_name": bill_name,
        "registered_name": registered_name,
        "profile_verification_score": new_score,
    }


@router.post("/payoneer-statement")
async def upload_payoneer_statement(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Manual Payoneer statement import — the fallback while partner OAuth
    credentials are pending. Parses payout rows and feeds them into the same
    income engine as the OAuth flow (connected_sources source='payoneer')."""
    user_id = user["sub"]
    original_filename = file.filename or "payoneer-statement.pdf"

    if not original_filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="File too large. Maximum size is 10MB")
    if len(pdf_bytes) < 100 or not pdf_bytes[:5].startswith(b"%PDF"):
        raise HTTPException(status_code=422, detail="Invalid or corrupt PDF file")

    metadata = get_pdf_metadata(pdf_bytes, filename=original_filename)
    raw_text, provenance = extract_text_with_provenance(pdf_bytes)
    metadata["extraction"] = provenance
    cleaned = clean_text(raw_text)

    if not is_payoneer_statement(cleaned):
        raise HTTPException(
            status_code=422,
            detail="NOT_PAYONEER_STATEMENT: this file does not look like a "
                   "Payoneer account statement.",
        )

    parsed = parse_payoneer_statement(cleaned)
    transactions = parsed["transactions"]
    if not transactions:
        raise HTTPException(
            status_code=422,
            detail="NO_PAYOUTS_FOUND: no payout rows detected. Upload a monthly "
                   "account statement, not a receipt or invoice.",
        )

    try:
        usd_to_lkr = await get_usd_to_lkr_rate()
        monthly_income = await build_monthly_income_async(transactions, usd_to_lkr)
        income_features = compute_income_features(monthly_income)
    except Exception as e:
        logger.exception("Payoneer statement income processing failed")
        raise HTTPException(status_code=500, detail="Income processing failed")

    metadata["biller_detected"] = "Payoneer"
    metadata["statement"] = {
        "payout_count": len(transactions),
        "skipped_rows": parsed["skipped"],
        "months": len(monthly_income),
    }

    db = get_supabase_admin()
    bill_id = str(uuid.uuid4())
    storage_path = f"bills/{user_id}/{bill_id}.pdf"
    try:
        db.storage.from_("bills").upload(storage_path, pdf_bytes)
    except Exception as e:
        logger.warning("Storage upload failed: %s", e)

    base_row = {
        "user_id": user_id,
        "source": "payoneer",
        "account_name": parsed["account_name"] or "Payoneer statement",
        "transaction_count": len(transactions),
        "date_range_months": len(monthly_income),
        "income_features": income_features,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "access_token_hash": "",
    }
    existing = db.table("connected_sources").select("id").eq("user_id", user_id).execute()
    try:
        db.table("connected_sources").upsert(
            {**base_row, "is_primary": len(existing.data) == 0},
            on_conflict="user_id,source",
        ).execute()
    except Exception:
        db.table("connected_sources").upsert(base_row, on_conflict="user_id,source").execute()

    sources = db.table("connected_sources").select("source").eq("user_id", user_id).execute()
    try:
        db.table("users").update({
            "connected_source_count": len(sources.data),
            "digital_tenure_months": int(len(monthly_income) or 0),
        }).eq("id", user_id).execute()
    except Exception as e:
        logger.warning("User stats update failed: %s", e)

    pending_row = {
        "id": bill_id,
        "user_id": user_id,
        "storage_path": storage_path,
        "biller_detected": "Payoneer",
        "fields": [
            {"field_name": "payout_count", "extracted_value": str(len(transactions)),
             "confidence": 1.0, "user_verified": False},
            {"field_name": "months_covered", "extracted_value": str(len(monthly_income)),
             "confidence": 1.0, "user_verified": False},
        ],
        "overall_confidence": 1.0,
        "identity_match_score": 0.0,
        "payment_on_time": None,
        "status": "verified",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        db.table("pending_bills").upsert({**pending_row, "metadata": metadata}).execute()
    except Exception as e:
        logger.warning("pending_bills metadata column missing, storing without it: %s", e)
        db.table("pending_bills").upsert(pending_row).execute()

    return {
        "bill_id": bill_id,
        "biller_detected": "Payoneer",
        "source": "payoneer",
        "payout_count": len(transactions),
        "skipped_rows": parsed["skipped"],
        "months_covered": len(monthly_income),
        "account_name": parsed["account_name"],
        "status": "verified",
        "metadata": metadata,
    }


@router.post("/ocr-review")
async def review_ocr_bill(
    body: OCRReviewRequest,
    user: dict = Depends(get_current_user),
):
    """User confirms/corrects OCR fields → bill moves pending → verified.

    Only verified bills feed scoring payment features. Bills never reviewed
    still count via the pending fallback in score compute (penalised).
    """
    user_id = user["sub"]
    db = get_supabase_admin()

    pending = db.table("pending_bills").select("*").eq("id", body.bill_id).eq(
        "user_id", user_id).execute()
    if not pending.data:
        raise HTTPException(status_code=404, detail="Pending bill not found")

    bill = pending.data[0]
    fields = bill.get("fields") or []
    if isinstance(fields, dict):
        fields = [{"field_name": k, "extracted_value": v} for k, v in fields.items()]

    corrections = body.corrected_fields or {}
    for field in fields:
        name = field.get("field_name")
        if name in corrections:
            field["extracted_value"] = corrections[name]
            field["user_verified"] = True
            field["confidence"] = 1.0

    on_time = validate_payment_on_time([
        {"field_name": f.get("field_name"), "extracted_value": f.get("extracted_value")}
        for f in fields if isinstance(f, dict)
    ])

    verified_row = {
        "id": bill["id"],
        "user_id": user_id,
        "storage_path": bill.get("storage_path"),
        "biller_detected": bill.get("biller_detected"),
        "fields": fields,
        "overall_confidence": bill.get("overall_confidence"),
        "identity_match_score": bill.get("identity_match_score"),
        "payment_on_time": on_time,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
    }
    if bill.get("metadata") is not None:
        try:
            db.table("verified_bills").upsert(
                {**verified_row, "metadata": bill["metadata"]}).execute()
        except Exception as e:
            logger.warning("verified_bills metadata column missing: %s", e)
            db.table("verified_bills").upsert(verified_row).execute()
    else:
        db.table("verified_bills").upsert(verified_row).execute()

    try:
        db.table("pending_bills").delete().eq("id", bill["id"]).execute()
    except Exception as e:
        logger.warning("pending_bills cleanup failed: %s", e)

    return {
        "bill_id": bill["id"],
        "biller_detected": bill.get("biller_detected"),
        "fields": fields,
        "payment_on_time": on_time,
        "status": "verified",
    }
