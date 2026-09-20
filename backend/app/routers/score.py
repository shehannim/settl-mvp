from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.core.database import get_supabase_admin
from app.services.normalisation_service import (
    compute_income_features, compute_payment_features,
    compute_platform_features, compute_footprint_features,
    build_feature_vector
)
from app.services.scoring_service import (
    run_scoring, compute_confidence_score, MODEL_VERSION
)
from datetime import datetime, timezone
import json
import logging

logger = logging.getLogger(__name__)

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

    # ── Income features — pooled across ALL income sources
    # (paypal, payoneer, plus manual upwork/fiverr verification).
    # Each row's statistics are weighted by its transaction count, which
    # approximates the pooled estimate; income_source_count records how many
    # independent streams contributed (matches training semantics where level
    # and multiplicity are separate features — never sum the levels).
    # Manual rows carry no transaction_count, so weight them by declared
    # months of history instead of dropping them to zero.
    sources_all = db.table("connected_sources").select("*").eq("user_id", user_id).execute()
    all_sources = sources_all.data or []
    income_rows = [s for s in all_sources if s.get("source") in ("paypal", "payoneer", "upwork", "fiverr")]

    INCOME_KEYS = (
        "income_cv", "income_trend_slope", "income_gap_months",
        "income_3m_avg", "income_6m_avg", "income_yoy_growth",
    )

    def _feat_dict(row):
        raw = row.get("income_features") or {}
        parsed = json.loads(raw) if isinstance(raw, str) else dict(raw)
        return parsed

    if income_rows:
        def _row_weight(r):
            try:
                tx = int(r.get("transaction_count") or 0)
            except (TypeError, ValueError):
                tx = 0
            if tx > 0:
                return tx
            # Manual upwork/fiverr: weight by declared months (min 1).
            try:
                return max(int(r.get("date_range_months") or 0), 1)
            except (TypeError, ValueError):
                return 1
        weights = [_row_weight(r) for r in income_rows]
        total_w = sum(weights)
        income_feats = {}
        for key in INCOME_KEYS:
            num, den = 0.0, 0
            for row, w in zip(income_rows, weights):
                val = _feat_dict(row).get(key)
                try:
                    num += float(val) * w
                    den += w
                except (TypeError, ValueError):
                    continue
            income_feats[key] = num / den if den else 0.0
        income_feats["income_source_count"] = len(income_rows)
    else:
        income_feats = {
            "income_cv": 1.0, "income_trend_slope": 0.0, "income_gap_months": 12,
            "income_source_count": 0, "income_3m_avg": 0.0,
            "income_6m_avg": 0.0, "income_yoy_growth": 0.0,
        }

    # ── Payment features — verified bills preferred; unreviewed pending
    # bills still count but their completeness is discounted (unconfirmed
    # OCR is weaker evidence than user-verified fields).
    bills = db.table("verified_bills").select(
        "payment_on_time, confirmed_at"
    ).eq("user_id", user_id).execute()
    using_pending = not bills.data
    if using_pending:
        bills = db.table("pending_bills").select(
            "payment_on_time, created_at"
        ).eq("user_id", user_id).execute()

    payment_feats = compute_payment_features(bills.data)
    if using_pending:
        payment_feats["bill_ontime_rate"] = payment_feats.get("bill_ontime_rate", 0.5) * 0.7
        payment_feats["payment_regularity"] = payment_feats.get("payment_regularity", 0.5) * 0.7

    # ── Platform features ──
    platform_feats = compute_platform_features(all_sources)

    # ── Footprint / history — use REAL months of history ──
    # date_range_months = len(monthly income) stored at connect time.
    # Longest observed history across income sources wins (histories overlap
    # in calendar time, so summing would double-count months).
    income_months = 0
    for row in income_rows:
        try:
            income_months = max(income_months, int(row.get("date_range_months") or 0))
        except (TypeError, ValueError):
            continue
    bill_months = len(bills.data or [])
    history_months = max(income_months, bill_months)
    digital_tenure = max(
        int(profile.get("digital_tenure_months") or 0),
        history_months,
    )
    sources = type("S", (), {"data": all_sources})()  # keep len(sources.data) shape below
    # LinkedIn education → identity strength (display + confidence multiplier).
    # Never lowers: missing LinkedIn must not punish thin files. The 28-feature
    # model itself is untouched (new inputs need a full retrain — Phase 2).
    identity_consistency = profile.get("identity_consistency_score", 0.5)
    for row in all_sources:
        if row.get("source") == "linkedin":
            try:
                from app.services.linkedin_service import education_identity_boost
                stored = row.get("income_features") or {}
                stored = json.loads(stored) if isinstance(stored, str) else dict(stored)
                identity_consistency = education_identity_boost(
                    stored.get("linkedin", stored), identity_consistency)
            except Exception:
                continue
    footprint_feats = compute_footprint_features(
        {
            "connected_source_count": len(all_sources),
            "digital_tenure_months": digital_tenure,
            "business_continuity": min(bill_months / 12.0, 1.0),
            "kyc_verified": profile.get("kyc_verified", False),
            "identity_consistency_score": identity_consistency,
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
        source_count=len(all_sources),
        history_months=history_months,
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
        "computed_at": datetime.now(timezone.utc).isoformat(),
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
    ).eq("user_id", user_id).order("computed_at").limit(50).execute()

    return {"history": result.data}

