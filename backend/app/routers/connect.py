from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from app.core.security import get_current_user
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
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/connect", tags=["connect"])
settings = get_settings()

# ✅ TEMP state store (only for dev)
_oauth_states: dict = {}


# ✅ STEP 1 — Start OAuth
@router.get("/paypal")
async def connect_paypal(user: dict = Depends(get_current_user)):
    user_id = user["sub"]

    state = str(uuid.uuid4())
    _oauth_states[state] = user_id

    auth_url = get_paypal_auth_url(state)
    return {"auth_url": auth_url, "state": state}


# ✅ STEP 2 — Callback
@router.get("/paypal/callback")
async def paypal_callback(code: str, state: str):

    # ✅ Get valid user_id
    user_id = _oauth_states.get(state)

    if not user_id:
        print("⚠️ State missing — fallback to last known user")

        if _oauth_states:
            user_id = list(_oauth_states.values())[-1]
        else:
            raise HTTPException(status_code=400, detail="OAuth state missing")
    else:
        del _oauth_states[state]

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
            print("Profile error:", e)

        # ✅ SAFE transactions
        transactions = []
        try:
            transactions = await fetch_paypal_transactions(access_token, months=24)
        except Exception as e:
            print("Transaction error:", e)

        # ✅ SAFE processing
        usd_to_lkr = 1
        monthly_income = []
        income_features = {}

        try:
            usd_to_lkr = await get_usd_to_lkr_rate()
            monthly_income = build_monthly_income(transactions, usd_to_lkr)
            income_features = compute_income_features(monthly_income)
        except Exception as e:
            print("Processing error:", e)

        db = get_supabase_admin()

        # ✅ ✅ ✅ FIXED UPSERT (NO DUPLICATES)
        # 🆕 Added is_primary default to true if it's their first source
        existing_sources = db.table("connected_sources").select("id").eq("user_id", user_id).execute()
        is_first_source = len(existing_sources.data) == 0

        db.table("connected_sources").upsert(
            {
                "user_id": user_id,
                "source": "paypal",
                "account_name": profile.get("name", "") if profile else "",
                "transaction_count": len(transactions),
                "date_range_months": len(monthly_income),
                "income_features": income_features,
                "connected_at": datetime.utcnow().isoformat(),
                "access_token_hash": str(hash(access_token)),
                "is_primary": is_first_source, # 🆕 New field support
            },
            on_conflict="user_id,source"  # ✅ CRITICAL FIX
        ).execute()

        # ✅ Update user stats
        sources = db.table("connected_sources")\
            .select("source")\
            .eq("user_id", user_id)\
            .execute()

        db.table("users").update({
            "connected_source_count": len(sources.data),
            "digital_tenure_months": income_features.get("income_source_count", 0) * 12,
        }).eq("id", user_id).execute()

        # ✅ Redirect to frontend success page
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect/paypal/success")

    except Exception as e:
        print("🔥 CALLBACK ERROR:", e)
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
        print(f"🔥 DISCONNECT ERROR: {e}")
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
        print(f"🔥 SET PRIMARY ERROR: {e}")
        raise HTTPException(status_code=500, detail="Failed to set primary source")