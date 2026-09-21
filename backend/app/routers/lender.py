from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_lender
from app.core.database import get_supabase_admin
from app.models.schemas import LoanOutcomeRequest
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lender", tags=["lender"])


def _safe_parse(val):
    if val is None:
        return []
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            import json as _json
            parsed = _json.loads(val)
            return parsed if isinstance(parsed, (dict, list)) else []
        except Exception:
            return []
    return []


@router.get("/query/{settl_id}")
async def query_score(settl_id: str, lender: dict = Depends(get_current_lender)):
    """
    Lender queries a user's score by Settl ID.
    Returns score + confidence + SHAP breakdown. Never returns raw financial data.
    """
    db = get_supabase_admin()

    # Look up user by Settl ID — identity columns only, never financial raw data.
    user_result = db.table("users").select(
        "id, full_name, email, kyc_verified"
    ).eq("settl_id", settl_id.strip().upper()).execute()

    if not user_result.data:
        raise HTTPException(status_code=404, detail="Settl ID not found")

    user = user_result.data[0]
    user_id = user["id"]

    # Check KYC
    if not user.get("kyc_verified"):
        raise HTTPException(status_code=403, detail="User identity not verified")

    # Get latest score
    score_result = db.table("scores").select("*").eq(
        "user_id", user_id
    ).order("computed_at", desc=True).limit(1).execute()

    if not score_result.data:
        raise HTTPException(status_code=404, detail="No score available for this user")

    s = score_result.data[0]

    # Lender thresholds (per-institution) — fall back to platform defaults.
    lender_row = db.table("lenders").select("min_score, min_confidence").eq("id", lender["sub"]).execute()
    min_score = 650
    min_conf = 0.60
    if lender_row.data:
        try:
            min_score = int(lender_row.data[0].get("min_score") or 650)
            min_conf = float(lender_row.data[0].get("min_confidence") or 0.60)
        except (TypeError, ValueError):
            pass
    meets_threshold = (s.get("score", 0) >= min_score) and (float(s.get("confidence", 0)) >= min_conf)

    # Log the lender query for audit
    try:
        db.table("audit_log").insert({
            "event": "lender_score_query",
            "user_id": user_id,
            "lender_id": lender["sub"],
            "lender_institution": lender.get("institution", ""),
            "score_queried": s["score"],
            "queried_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning("Audit log insert failed: %s", e)

    return {
        "settl_id": settl_id.strip().upper(),
        "user_id": user_id,
        "applicant_name": user["full_name"],
        "email": user.get("email"),
        "kyc_verified": user.get("kyc_verified", False),
        "score": s["score"],
        "band": s["band"],
        "confidence": s["confidence"],
        "meets_threshold": meets_threshold,
        "top_positive_factors": _safe_parse(s.get("top_positive_factors")),
        "top_negative_factors": _safe_parse(s.get("top_negative_factors")),
        "model_version": s["model_version"],
        "scored_at": s["computed_at"],
        # Boundary: score + identity + explanations only.
        # Never include: raw transactions, NIC, PayPal data, bill contents
    }


@router.get("/me")
async def lender_profile(lender: dict = Depends(get_current_lender)):
    """Own institution profile: thresholds shown in the portal header."""
    db = get_supabase_admin()
    result = db.table("lenders").select(
        "id, email, institution_name, min_score, min_confidence"
    ).eq("id", lender["sub"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lender not found")
    row = result.data[0]
    return {
        "lender_id": row["id"],
        "email": row.get("email"),
        "institution_name": row.get("institution_name") or "Lender",
        "min_score": row.get("min_score") or 650,
        "min_confidence": row.get("min_confidence") or 0.60,
    }


@router.post("/outcome")
async def report_outcome(body: LoanOutcomeRequest, lender: dict = Depends(get_current_lender)):
    """
    Lender reports loan decision and repayment outcome.
    Stored for model feedback loop retraining.
    """
    db = get_supabase_admin()

    db.table("loan_outcomes").insert({
        "user_id": body.user_id,
        "lender_id": lender["sub"],
        "score_at_decision": body.score_at_decision,
        "confidence_at_decision": body.confidence_at_decision,
        "model_version": body.model_version,
        "decision": body.decision,
        "loan_amount_lkr": body.loan_amount_lkr,
        "repayment_status": body.repayment_status or "pending",
        "reported_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    # Count total labelled outcomes for retraining trigger
    outcome_count = db.table("loan_outcomes").select(
        "id", count="exact"
    ).neq("repayment_status", "pending").execute()

    total = outcome_count.count or 0
    retrain_ready = total >= 500

    return {
        "success": True,
        "outcome_recorded": True,
        "total_labelled_outcomes": total,
        "retrain_trigger_at": 500,
        "retrain_ready": retrain_ready,
        "message": "Outcome recorded for model feedback loop." + (
            " Retraining threshold reached." if retrain_ready else
            f" {500 - total} more outcomes needed to trigger retraining."
        ),
    }
