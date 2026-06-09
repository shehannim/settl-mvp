from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.core.database import get_supabase_admin
from app.services.normalisation_service import (
    compute_income_features, compute_payment_features,
    compute_platform_features, compute_footprint_features,
    build_feature_vector, get_usd_to_lkr_rate
)
from app.services.scoring_service import (
    run_scoring, compute_confidence_score, MODEL_VERSION
)
from datetime import datetime
import json

router = APIRouter(prefix="/api/score", tags=["score"])


# ✅ Serializer to fix numpy types
def serialize(obj):
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize(v) for v in obj]
    elif hasattr(obj, "item"):  # handles numpy types (float32, int64, etc.)
        return obj.item()
    return obj


@router.post("/compute")
async def compute_score(user: dict = Depends(get_current_user)):

    user_id = user["sub"]
    db = get_supabase_admin()

    # ── Check KYC ──
    user_data = db.table("users").select("*").eq("id", user_id).execute()
    if not user_data.data:
        raise HTTPException(status_code=404, detail="User not found")

    profile = user_data.data[0]

    if not profile.get("kyc_verified"):
        raise HTTPException(
            status_code=403,
            detail="KYC_INCOMPLETE: Complete identity verification before scoring."
        )

    if profile.get("fraud_flag_count", 0) > 2:
        raise HTTPException(
            status_code=403,
            detail="HARD_FRAUD_FLAG: Profile has been flagged. Contact support."
        )

    # ── PayPal income features ──
    paypal_source = db.table("connected_sources").select("*").eq(
        "user_id", user_id).eq("source", "paypal").execute()

    if paypal_source.data:
        raw = paypal_source.data[0].get("income_features") or {}
        income_feats = json.loads(raw) if isinstance(raw, str) else raw
        income_feats["income_source_count"] = len(
            db.table("connected_sources").select("source").eq("user_id", user_id).execute().data
        )
    else:
        income_feats = {
            "income_cv": 1.0, "income_trend_slope": 0.0, "income_gap_months": 12,
            "income_source_count": 0, "income_3m_avg": 0.0,
            "income_6m_avg": 0.0, "income_yoy_growth": 0.0,
        }

    # ── Payment features ──
    bills = db.table("verified_bills").select(
        "payment_on_time, confirmed_at"
    ).eq("user_id", user_id).execute()

    payment_feats = compute_payment_features(bills.data)

    # ── Platform features ──
    sources = db.table("connected_sources").select("*").eq("user_id", user_id).execute()
    platform_feats = compute_platform_features(sources.data)

    # ── Footprint features ──
    footprint_feats = compute_footprint_features(
        {
            "connected_source_count": len(sources.data),
            "digital_tenure_months": income_feats.get("income_source_count", 0) * 12,
            "business_continuity": min(len(bills.data) / 12.0, 1.0),
            "kyc_verified": profile.get("kyc_verified", False),
            "identity_consistency_score": profile.get("identity_consistency_score", 0.5),
        },
        fraud_flags=profile.get("fraud_flag_count", 0),
    )

    # ── Check minimum data ──
    if (len(sources.data) + len(bills.data)) < 1:
        raise HTTPException(
            status_code=422,
            detail="INSUFFICIENT_DATA: Connect at least one data source before scoring."
        )

    # ── Run model ──
    feature_vector = build_feature_vector(
        income_feats, payment_feats, platform_feats, footprint_feats
    )

    raw_score_result = run_scoring(feature_vector)
    score_result = serialize(raw_score_result)  # ✅ FIXED

    # ── Compute confidence ──
    confidence, confidence_breakdown = compute_confidence_score(
        source_count=len(sources.data),
        history_months=income_feats.get("income_source_count", 0) * 6,
        data_completeness=payment_feats.get("bill_ontime_rate", 0.5),
        soft_flag_count=profile.get("fraud_flag_count", 0),
        identity_consistency=profile.get("identity_consistency_score", 0.5),
    )

    confidence_breakdown = serialize(confidence_breakdown)

    # ── Store score ── ✅ FIXED (NO json.dumps)
    score_record = {
        "user_id": user_id,
        "score": int(score_result["score"]),
        "band": score_result["band"],
        "confidence": float(confidence),
        "confidence_breakdown": confidence_breakdown,
        "categories": score_result["categories"],
        "top_positive_factors": score_result["top_positive_factors"],
        "top_negative_factors": score_result["top_negative_factors"],
        "improvement_tips": score_result["improvement_tips"],
        "feature_vector": feature_vector.tolist(),
        "model_version": MODEL_VERSION,
        "computed_at": datetime.utcnow().isoformat(),
    }

    db.table("scores").insert(score_record).execute()

    # ── Return cleaned response ── ✅ FIXED
    return {
        "score": int(score_result["score"]),
        "band": score_result["band"],
        "confidence": float(confidence),
        "categories": score_result["categories"],
        "top_positive_factors": score_result["top_positive_factors"],
        "top_negative_factors": score_result["top_negative_factors"],
        "confidence_breakdown": confidence_breakdown,
    }


@router.get("/result")
async def get_score_result(user: dict = Depends(get_current_user)):

    user_id = user["sub"]
    db = get_supabase_admin()

    result = db.table("scores").select("*").eq("user_id", user_id).order(
        "computed_at", desc=True
    ).limit(1).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="No score found.")

    s = result.data[0]

    # ✅ Handle BOTH old + new records
    def safe_parse(val):
        if isinstance(val, dict) or isinstance(val, list):
            return val
        try:
            return json.loads(val)
        except:
            return val

    warning = None
    if s["confidence"] < 0.25:
        warning = "LOW_CONFIDENCE: Connect more data sources."

    return {
        "score": s["score"],
        "band": s["band"],
        "confidence": s["confidence"],
        "confidence_breakdown": safe_parse(s.get("confidence_breakdown")),
        "categories": safe_parse(s.get("categories")),
        "top_positive_factors": safe_parse(s.get("top_positive_factors")),
        "top_negative_factors": safe_parse(s.get("top_negative_factors")),
        "improvement_tips": safe_parse(s.get("improvement_tips")),
        "model_version": s["model_version"],
        "computed_at": s["computed_at"],
        "warning": warning,
    }


@router.get("/history")
async def get_score_history(user: dict = Depends(get_current_user)):

    user_id = user["sub"]
    db = get_supabase_admin()

    result = db.table("scores").select(
        "score, confidence, band, computed_at"
    ).eq("user_id", user_id).order("computed_at").execute()

    return {"history": result.data}

