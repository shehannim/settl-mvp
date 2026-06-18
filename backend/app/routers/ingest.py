from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.security import get_current_user
from app.core.database import get_supabase_admin
from app.services.ocr_service import process_bill
from app.services.kyc_service import fuzzy_name_match
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


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


@router.post("/utility-bill")
async def upload_utility_bill(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]

    filename = file.filename.lower()

    # ✅ FIXED VALIDATION
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

    # ✅ DEBUG ADDED HERE
    try:
        print("✅ OCR START:", filename)

        ocr_result = process_bill(pdf_bytes) or {}

        print("✅ OCR RESULT:", ocr_result)

    except Exception as e:
        print("OCR processing error:", e)
        raise HTTPException(status_code=500, detail="OCR processing failed")

    fields = normalize_ocr_fields(ocr_result.get("fields", []))
    raw_text = extract_raw_text(ocr_result)

    print("✅ OCR TEXT LENGTH:", len(raw_text))

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

    identity_match_score = 0.5

    for field in fields:
        if field["field_name"] in ("account_holder", "customer_name") and field.get("extracted_value"):
            identity_match_score = fuzzy_name_match(
                registered_name,
                field["extracted_value"]
            )
            break

    db.table("pending_bills").upsert({
        "id": bill_id,
        "user_id": user_id,
        "storage_path": storage_path,
        "biller_detected": biller_detected,
        "fields": fields,
        "overall_confidence": overall_confidence,
        "identity_match_score": identity_match_score,
        "payment_on_time": ocr_result.get("payment_on_time"),
        "status": status,
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    return {
        "bill_id": bill_id,
        "biller_detected": biller_detected,
        "fields": fields,
        "overall_confidence": overall_confidence,
        "identity_match_score": round(identity_match_score, 2),
        "payment_on_time": ocr_result.get("payment_on_time"),
        "status": status,
        "raw_text": raw_text,
        "has_raw_text": bool(raw_text),
    }


# ✅ REST REMAINS UNCHANGED (your original code)
@router.post("/ocr-review")
async def submit_ocr_review(
    bill_id: str,
    corrected_fields: dict,
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    db = get_supabase_admin()

    result = db.table("pending_bills")\
        .select("*")\
        .eq("id", bill_id)\
        .eq("user_id", user_id)\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Bill not found")

    pending = result.data[0]

    fields = pending["fields"] or []

    for field in fields:
        if field["field_name"] in corrected_fields:
            field["extracted_value"] = corrected_fields[field["field_name"]]
            field["user_verified"] = True
            field["confidence"] = 0.90

    db.table("verified_bills").insert({
        "id": bill_id,
        "user_id": user_id,
        "storage_path": pending["storage_path"],
        "biller_detected": pending["biller_detected"],
        "fields": fields,
        "overall_confidence": pending["overall_confidence"],
        "identity_match_score": pending["identity_match_score"],
        "payment_on_time": pending.get("payment_on_time"),
        "confirmed_at": datetime.utcnow().isoformat(),
    }).execute()

    db.table("pending_bills").delete().eq("id", bill_id).execute()

    all_bills = db.table("verified_bills")\
        .select("payment_on_time")\
        .eq("user_id", user_id)\
        .execute()

    bills_data = all_bills.data

    on_time_count = sum(
        1 for bill in bills_data
        if bill.get("payment_on_time") is True
    )

    total_with_dates = sum(
        1 for bill in bills_data
        if bill.get("payment_on_time") is not None
    )

    on_time_rate = (
        on_time_count / total_with_dates
        if total_with_dates > 0
        else 0.5
    )

    db.table("users").update({
        "bill_ontime_rate": on_time_rate,
        "bill_count": len(bills_data),
    }).eq("id", user_id).execute()

    return {
        "success": True,
        "bill_id": bill_id,
        "confirmed_fields": fields,
        "payment_on_time": pending.get("payment_on_time"),
        "confidence_impact": round(
            min(len(bills_data) / 12.0, 1.0) * 0.25 * 0.10,
            3
        ),
    }


@router.get("/bills")
async def get_uploaded_bills(user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    db = get_supabase_admin()

    result = db.table("verified_bills")\
        .select("id, biller_detected, overall_confidence, payment_on_time, confirmed_at")\
        .eq("user_id", user_id)\
        .order("confirmed_at", desc=True)\
        .execute()

    return {
        "bills": result.data,
        "count": len(result.data),
    }


@router.get("/pending-bills")
async def get_pending_bills(user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    db = get_supabase_admin()

    result = db.table("pending_bills")\
        .select("id, biller_detected, fields, overall_confidence, identity_match_score, status, created_at")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .execute()

    return {
        "pending_bills": result.data,
        "count": len(result.data),
    }