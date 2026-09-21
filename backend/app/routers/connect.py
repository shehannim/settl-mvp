from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
from urllib.parse import urlparse
from app.core.security import get_current_user, create_oauth_state, decode_oauth_state
from app.core.database import get_supabase_admin
from app.core.config import get_settings
from app.services.paypal_service import (
    get_paypal_auth_url,
    exchange_paypal_code,
    fetch_paypal_transactions,
    fetch_paypal_profile
)
from app.services.payoneer_service import (
    is_configured as is_payoneer_configured,
    get_payoneer_auth_url,
    exchange_payoneer_code,
    fetch_payoneer_transactions,
    fetch_payoneer_profile,
)
from app.services.linkedin_service import (
    is_configured as is_linkedin_configured,
    get_linkedin_auth_url,
    exchange_linkedin_code,
    fetch_linkedin_identity,
)
from app.services.normalisation_service import (
    get_usd_to_lkr_rate,
    build_monthly_income,
    build_monthly_income_async,
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


def _is_paypal_configured() -> bool:
    return bool(settings.PAYPAL_CLIENT_ID and settings.PAYPAL_CLIENT_SECRET)


def _allowed_frontend_bases() -> list:
    """FRONTEND_URL may be a single URL or comma-separated allowlist."""
    raw = (settings.FRONTEND_URL or "").strip()
    bases = [b.strip().rstrip("/") for b in raw.split(",") if b.strip()]
    for local in ("http://localhost:5173", "http://127.0.0.1:5173"):
        if local not in bases:
            bases.append(local)
    return bases


def _resolve_frontend_base(request: Request) -> str:
    """Never bounce the user to a hardcoded localhost when deployed.

    Prefers the calling page's Origin/Referer when it is allowlisted,
    otherwise falls back to the first configured FRONTEND_URL.
    """
    allowed = _allowed_frontend_bases()
    for header in (request.headers.get("origin"), request.headers.get("referer")):
        if not header:
            continue
        try:
            parsed = urlparse(header)
            base = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        except Exception:
            continue
        if base in allowed:
            return base
    return allowed[0] if allowed else settings.FRONTEND_URL.rstrip("/")


def _wants_json(request: Request) -> bool:
    accept = (request.headers.get("accept") or "").lower()
    sec_fetch = (request.headers.get("sec-fetch-mode") or "").lower()
    return "application/json" in accept or sec_fetch == "cors"


def _callback_result(request: Request, success_path: str):
    """SPA fetch callers stay in-app (JSON); browser navigations redirect."""
    base = _resolve_frontend_base(request)
    if _wants_json(request):
        return {"status": "success", "redirect": f"{base}{success_path}"}
    return RedirectResponse(f"{base}{success_path}")


# ✅ STEP 1 — Start OAuth
@router.get("/paypal")
async def connect_paypal(user: dict = Depends(get_current_user)):
    if not _is_paypal_configured():
        raise HTTPException(
            status_code=503,
            detail="PAYPAL_NOT_CONFIGURED: app credentials missing. "
                   "Set PAYPAL_CLIENT_ID/SECRET on the backend.",
        )
    user_id = user["sub"]
    state = create_oauth_state(user_id)
    auth_url = get_paypal_auth_url(state)
    return {"auth_url": auth_url, "state": state}


# ✅ STEP 2 — Callback
@router.get("/paypal/callback")
async def paypal_callback(request: Request, code: str, state: str):

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
            "account_name": (profile.get("name", "") if profile else "") or "PayPal Business",
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

        # ✅ Back to the frontend that started the flow (JSON for SPA fetch)
        return _callback_result(request, "/connect/paypal/success")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("PayPal callback failed")
        raise HTTPException(status_code=500, detail="Callback failed")


# ── PAYONEER (same shape as PayPal; multi-currency via live FX) ──

@router.get("/payoneer")
async def connect_payoneer(user: dict = Depends(get_current_user)):
    if not is_payoneer_configured():
        raise HTTPException(
            status_code=503,
            detail="PAYONEER_NOT_CONFIGURED: partner credentials missing. "
                   "Upload a Payoneer statement instead.",
        )
    user_id = user["sub"]
    state = create_oauth_state(user_id, purpose="payoneer_oauth")
    return {"auth_url": get_payoneer_auth_url(state), "state": state}


@router.get("/payoneer/callback")
async def payoneer_callback(request: Request, code: str, state: str):
    # Purpose-bound state — a PayPal state is rejected here.
    user_id = decode_oauth_state(state, purpose="payoneer_oauth")

    try:
        tokens = await exchange_payoneer_code(code)
        if not tokens:
            raise HTTPException(status_code=400, detail="Payoneer auth failed")

        access_token = tokens.get("access_token")

        profile = {}
        try:
            profile = await fetch_payoneer_profile(access_token) or {}
        except Exception as e:
            logger.warning("Payoneer profile fetch failed: %s", e)

        transactions = []
        try:
            transactions = await fetch_payoneer_transactions(
                access_token, account_id=(profile or {}).get("account_id", ""), months=24
            )
        except Exception as e:
            logger.warning("Payoneer transaction fetch failed: %s", e)

        usd_to_lkr = 305.0
        monthly_income = []
        income_features = {}
        try:
            usd_to_lkr = await get_usd_to_lkr_rate()
            monthly_income = await build_monthly_income_async(transactions, usd_to_lkr)
            income_features = compute_income_features(monthly_income)
        except Exception as e:
            logger.warning("Payoneer income processing failed: %s", e)

        db = get_supabase_admin()
        existing_sources = db.table("connected_sources").select("id").eq("user_id", user_id).execute()
        is_first_source = len(existing_sources.data) == 0

        base_row = {
            "user_id": user_id,
            "source": "payoneer",
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

        return _callback_result(request, "/connect/payoneer/success")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Payoneer callback failed")
        raise HTTPException(status_code=500, detail="Callback failed")


# ── LINKEDIN VERIFIED (identity + education signal, not income) ──

@router.get("/linkedin")
async def connect_linkedin(user: dict = Depends(get_current_user)):
    if not is_linkedin_configured():
        raise HTTPException(
            status_code=503,
            detail="LINKEDIN_NOT_CONFIGURED: app credentials missing. "
                   "Register at developer.linkedin.com (Development tier works "
                   "for app admins in demos).",
        )
    user_id = user["sub"]
    state = create_oauth_state(user_id, purpose="linkedin_oauth")
    return {"auth_url": get_linkedin_auth_url(state), "state": state}


@router.get("/linkedin/callback")
async def linkedin_callback(request: Request, code: str, state: str):
    user_id = decode_oauth_state(state, purpose="linkedin_oauth")

    try:
        tokens = await exchange_linkedin_code(code)
        if not tokens:
            raise HTTPException(status_code=400, detail="LinkedIn auth failed")

        access_token = tokens.get("access_token")

        identity = {}
        try:
            identity = await fetch_linkedin_identity(access_token) or {}
        except Exception as e:
            logger.warning("LinkedIn identity fetch failed: %s", e)

        if not identity:
            raise HTTPException(status_code=400, detail="LinkedIn identity failed")

        db = get_supabase_admin()
        existing = db.table("connected_sources").select("id").eq("user_id", user_id).execute()

        base_row = {
            "user_id": user_id,
            "source": "linkedin",
            "account_name": identity.get("name", ""),
            "transaction_count": 0,
            "date_range_months": 0,
            "income_features": {"linkedin": identity},
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "access_token_hash": _hash_token(access_token) if access_token else "",
        }
        try:
            db.table("connected_sources").upsert(
                {**base_row, "is_primary": len(existing.data) == 0},
                on_conflict="user_id,source",
            ).execute()
        except Exception:
            db.table("connected_sources").upsert(
                base_row, on_conflict="user_id,source").execute()

        sources = db.table("connected_sources").select("source").eq(
            "user_id", user_id).execute()
        try:
            db.table("users").update(
                {"connected_source_count": len(sources.data)}
            ).eq("id", user_id).execute()
        except Exception as e:
            logger.warning("User stats update failed: %s", e)

        return _callback_result(request, "/connect/linkedin/success")

    except HTTPException:
        raise
    except Exception:
        logger.exception("LinkedIn callback failed")
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

    import json as _json
    sources = []
    for s in result.data:
        feats = s.get("income_features") or {}
        if isinstance(feats, str):
            try:
                feats = _json.loads(feats)
            except Exception:
                feats = {}
        # Monthly LKR estimate so the income hub can render live figures
        # instead of "—" (median freelance income = LKR 150k, same as engine).
        monthly_avg_lkr = None
        for key in ("income_6m_avg", "income_3m_avg"):
            try:
                if feats.get(key):
                    monthly_avg_lkr = round(float(feats[key]) * 150_000)
                    break
            except (TypeError, ValueError):
                continue
        sources.append({
            "source": s["source"],
            "connected": True,
            "account_name": s.get("account_name"),
            "transaction_count": s.get("transaction_count"),
            "date_range_months": s.get("date_range_months"),
            "connected_at": s.get("connected_at"),
            "is_primary": s.get("is_primary", False), # 🆕 Include in frontend payload
            "monthly_avg_lkr": monthly_avg_lkr,
            "is_demo": bool(feats.get("demo")),
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

class ManualConnectRequest(BaseModel):
    source: str  # upwork | fiverr
    account_name: Optional[str] = ""
    profile_url: Optional[str] = ""
    monthly_avg_lkr: Optional[float] = 0
    months: Optional[int] = 6


ALLOWED_MANUAL_SOURCES = {"upwork", "fiverr"}


@router.post("/manual")
async def connect_manual(body: ManualConnectRequest, user: dict = Depends(get_current_user)):
    """Manual freelance connect — Upwork/Fiverr have no public OAuth for
    freelancers, so users verify via profile URL + declared average.
    Creates a connected_sources row so scoring/confidence count it."""
    source = (body.source or "").strip().lower()
    if source not in ALLOWED_MANUAL_SOURCES:
        raise HTTPException(status_code=422, detail="Source must be 'upwork' or 'fiverr'")
    monthly_avg = max(float(body.monthly_avg_lkr or 0), 0)
    months = min(max(int(body.months or 6), 1), 24)
    if monthly_avg <= 0:
        raise HTTPException(status_code=422, detail="Enter your average monthly earnings")

    # Normalise against LKR 150k median freelance income (same as income engine).
    norm = min(monthly_avg / 150_000.0, 5.0)
    income_features = {
        "income_cv": 0.35,
        "income_trend_slope": 0.05,
        "income_gap_months": 0,
        "income_source_count": 1,
        "income_3m_avg": float(norm),
        "income_6m_avg": float(norm),
        "income_yoy_growth": 0.0,
        "manual": True,
        "profile_url": body.profile_url or "",
        "months_declared": months,
    }

    user_id = user["sub"]
    db = get_supabase_admin()
    existing = db.table("connected_sources").select("id").eq("user_id", user_id).execute()
    base_row = {
        "user_id": user_id,
        "source": source,
        "account_name": body.account_name or body.profile_url or f"{source.capitalize()} profile",
        "transaction_count": 0,
        "date_range_months": months,
        "income_features": income_features,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "access_token_hash": "",
    }
    try:
        db.table("connected_sources").upsert(
            {**base_row, "is_primary": len(existing.data) == 0},
            on_conflict="user_id,source",
        ).execute()
    except Exception:
        db.table("connected_sources").upsert(base_row, on_conflict="user_id,source").execute()

    sources = db.table("connected_sources").select("source").eq("user_id", user_id).execute()
    try:
        db.table("users").update({"connected_source_count": len(sources.data)}).eq("id", user_id).execute()
    except Exception as e:
        logger.warning("User stats update failed: %s", e)

    return {"status": "success", "source": source, "source_count": len(sources.data)}


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