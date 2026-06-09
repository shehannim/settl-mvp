from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_lender
from app.core.database import get_supabase_admin
from app.models.schemas import LoanOutcomeRequest
from datetime import datetime
import json

router = APIRouter(prefix="/api/lender", tags=["lender"])


@router.get("/query/{settl_id}")
async def query_score(settl_id: str, lender: dict = Depends(get_current_lender)):
    """
    Lender queries a user's score by Settl ID.
    Returns score + confidence + SHAP breakdown. Never returns raw financial data.
    """
    db = get_supabase_admin()

    # Look up user by Settl ID
    user_result = db.table("users").select(
        "id, full_name, kyc_verified"
    ).eq("settl_id", settl_id).execute()

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

    # Log the lender query for audit
    db.table("audit_log").insert({
        "event": "lender_score_query",
        "user_id": user_id,
        "lender_id": lender["sub"],
        "lender_institution": lender.get("institution", ""),
        "score_queried": s["score"],
        "queried_at": datetime.utcnow().isoformat(),
    }).execute()

    return {
        "settl_id": settl_id,
        "applicant_name": user["full_name"],
        "score": s["score"],
        "band": s["band"],
        "confidence": s["confidence"],
        "top_positive_factors": json.loads(s["top_positive_factors"]) if s.get("top_positive_factors") else [],
        "top_negative_factors": json.loads(s["top_negative_factors"]) if s.get("top_negative_factors") else [],
        "model_version": s["model_version"],
        "scored_at": s["computed_at"],
        # Never include: raw transactions, NIC, PayPal data, bill contents
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
        "reported_at": datetime.utcnow().isoformat(),
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
