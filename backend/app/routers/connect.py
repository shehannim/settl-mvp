from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from app.core.security import get_current_user, create_oauth_state, decode_oauth_state
from app.core.database import get_supabase_admin
from app.core.config import get_settings
from app.services.paypal_service import (
    get_paypal_auth_url,
    exchange_paypal_code,
    fetch_paypal_transactions,
    fetch_paypal_profile
)
from app.services.normalisation_service import (
    get_usd_to_lkr_rate,
    build_monthly_income,
    compute_income_features
)
from datetime import datetime, timezone
import hashlib
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/connect", tags=["connect"])
settings = get_settings()


def _hash_token(token: str) -> str:
    # SHA-256, never Python's randomized hash() and never the raw token.
    return hashlib.sha256(token.encode()).hexdigest()


# ✅ STEP 1 — Start OAuth
@router.get("/paypal")
async def connect_paypal(user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    state = create_oauth_state(user_id)
    auth_url = get_paypal_auth_url(state)
    return {"auth_url": auth_url, "state": state}


# ✅ STEP 2 — Callback
@router.get("/paypal/callback")
async def paypal_callback(code: str, state: str):

    # Stateless signed state — no fallback to another user.
    user_id = decode_oauth_state(state)

    try:
        # ✅ Exchange code → token
        tokens = await exchange_paypal_code(code)

        if not tokens:
            raise HTTPException(status_code=400, detail="PayPal auth failed")

        access_token = tokens.get("access_token")

        # ✅ SAFE profile
        profile = {}
        try:
            profile = await fetch_paypal_profile(access_token)
        except Exception as e:
            logger.warning("PayPal profile fetch failed: %s", e)

        # ✅ SAFE transactions
        transactions = []
        try:
            transactions = await fetch_paypal_transactions(access_token, months=24)
        except Exception as e:
            logger.warning("PayPal transaction fetch failed: %s", e)

        # ✅ SAFE processing
        usd_to_lkr = 1.0
        monthly_income = []
        income_features = {}

        try:
            usd_to_lkr = await get_usd_to_lkr_rate()
            monthly_income = build_monthly_income(transactions, usd_to_lkr)
            income_features = compute_income_features(monthly_income)
        except Exception as e:
            logger.warning("Income processing failed: %s", e)

        db = get_supabase_admin()

        existing_sources = db.table("connected_sources").select("id").eq("user_id", user_id).execute()
        is_first_source = len(existing_sources.data) == 0

        # is_primary column may not exist on older DBs — include only if supported.
        # We attempt with is_primary, and retry without it on schema error.
        base_row = {
            "user_id": user_id,
            "source": "paypal",
            "account_name": (profile.get("name", "") if profile else ""),
            "transaction_count": len(transactions),
            "date_range_months": len(monthly_income),
            "income_features": income_features,
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "access_token_hash": _hash_token(access_token) if access_token else "",
        }
        try:
            db.table("connected_sources").upsert(
                {**base_row, "is_primary": is_first_source},
                on_conflict="user_id,source",
            ).execute()
        except Exception:
            db.table("connected_sources").upsert(
                base_row,
                on_conflict="user_id,source",
            ).execute()

        # ✅ Update user stats — tenure = actual months of history, not source_count*12
        sources = db.table("connected_sources")\
            .select("source")\
            .eq("user_id", user_id)\
            .execute()

        try:
            db.table("users").update({
                "connected_source_count": len(sources.data),
                "digital_tenure_months": int(len(monthly_income) or 0),
            }).eq("id", user_id).execute()
        except Exception as e:
            logger.warning("User stats update failed: %s", e)

        # ✅ Redirect to frontend success page
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect/paypal/success")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("PayPal callback failed")
        raise HTTPException(status_code=500, detail="Callback failed")


# ✅ STEP 3 — Get connected sources (USED BY DASHBOARD)
@router.get("/sources")
async def get_connected_sources(user: dict = Depends(get_current_user)):
    user_id = user["sub"]

    db = get_supabase_admin()
    result = db.table("connected_sources")\
        .select("*")\
        .eq("user_id", user_id)\
        .execute()

    sources = []
    for s in result.data:
        sources.append({
            "source": s["source"],
            "connected": True,
            "account_name": s.get("account_name"),
            "transaction_count": s.get("transaction_count"),
            "date_range_months": s.get("date_range_months"),
            "connected_at": s.get("connected_at"),
            "is_primary": s.get("is_primary", False) # 🆕 Include in frontend payload
        })

    # ✅ Confidence calculation
    source_count = len(sources)
    breadth = min(source_count / 4.0, 1.0)

    if source_count >= 3:
        breadth = min(breadth + 0.1, 1.0)

    return {
        "sources": sources,
        "confidence_contribution": round(breadth * 0.40, 3),
        "source_count": source_count,
    }


# ==========================================
# 🆕 NEW ENDPOINTS FOR FRONTEND INCOME HUB
# ==========================================

# ✅ STEP 4 — Disconnect a source
@router.delete("/{source_name}")
async def disconnect_source(source_name: str, user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    db = get_supabase_admin()

    try:
        # 1. Delete the specific source
        db.table("connected_sources")\
          .delete()\
          .eq("user_id", user_id)\
          .eq("source", source_name)\
          .execute()

        # 2. Update user stats to reflect the removal
        sources = db.table("connected_sources").select("source").eq("user_id", user_id).execute()
        
        db.table("users").update({
            "connected_source_count": len(sources.data),
        }).eq("id", user_id).execute()

        # 3. If they deleted their primary, randomly assign a new primary if one exists
        if len(sources.data) > 0:
            remaining_primary = db.table("connected_sources").select("id").eq("user_id", user_id).eq("is_primary", True).execute()
            if len(remaining_primary.data) == 0:
                first_source = sources.data[0]["source"]
                db.table("connected_sources").update({"is_primary": True}).eq("user_id", user_id).eq("source", first_source).execute()

        return {"status": "success", "message": f"{source_name.capitalize()} disconnected"}

    except Exception as e:
        logger.exception("Disconnect failed for source=%s", source_name)
        raise HTTPException(status_code=500, detail="Failed to disconnect source")


# ✅ STEP 5 — Set a source as primary
@router.patch("/{source_name}/primary")
async def set_primary_source(source_name: str, user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    db = get_supabase_admin()

    try:
        # 1. Set all sources for this user to NOT primary
        db.table("connected_sources")\
          .update({"is_primary": False})\
          .eq("user_id", user_id)\
          .execute()

        # 2. Set the requested source to primary
        db.table("connected_sources")\
          .update({"is_primary": True})\
          .eq("user_id", user_id)\
          .eq("source", source_name)\
          .execute()

        return {"status": "success", "message": f"{source_name.capitalize()} set as primary"}

    except Exception as e:
        logger.exception("Set primary failed for source=%s", source_name)
        raise HTTPException(status_code=500, detail="Failed to set primary source")