"""LinkedIn Verified integration (identity + education signal).

What LinkedIn actually exposes (verified against Microsoft Learn, 2026):
- Self-serve (Development/Lite + OpenID Connect): name, email, photo, profile URL.
- Plus tier scope r_most_recent_education: most-recent school + degree.
- Development tier only works for app admins — perfect for demos, not prod.

Design consequences (be honest about them):
- Education is SELF-REPORTED and most-recent-only. It feeds identity
  verification strength, never income features.
- The 28-feature XGBoost model is FIXED — new model inputs require a full
  retrain (Phase-2 item). So education boosts identity_consistency_score
  (a documented confidence multiplier) and is displayed on the profile.
"""
import logging
from typing import Optional, Dict
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_HTTP_TIMEOUT = httpx.Timeout(15.0, connect=10.0)


def _scopes() -> str:
    return settings.LINKEDIN_SCOPES


def is_configured() -> bool:
    return bool(settings.LINKEDIN_CLIENT_ID and settings.LINKEDIN_CLIENT_SECRET)


def get_linkedin_auth_url(state: str) -> str:
    params = urlencode({
        "response_type": "code",
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
        "scope": _scopes(),
        "state": state,
    })
    return f"{settings.LINKEDIN_AUTH_URL}?{params}"


async def exchange_linkedin_code(code: str) -> Optional[Dict]:
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.post(
            f"https://www.linkedin.com{settings.LINKEDIN_TOKEN_PATH}",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
            },
        )
    if resp.status_code != 200:
        logger.warning("LinkedIn token exchange failed: %s", resp.text[:300])
        return None
    return resp.json()


def _locale_string(block: Optional[Dict]) -> str:
    if not block or not isinstance(block, dict):
        return ""
    loc = block.get("localized") or {}
    if isinstance(loc, dict) and loc:
        return str(next(iter(loc.values())))
    return str(block) if isinstance(block, str) else ""


def parse_identity(payload: Dict) -> Dict:
    """Normalises /identityMe (all tiers) into profile + education.

    Education present only on Plus tier; absence is normal, not an error.
    """
    basic = payload.get("basicInfo") or {}
    edu = payload.get("mostRecentEducation") or {}
    return {
        "name": " ".join(
            n for n in [
                _locale_string(basic.get("firstName")),
                _locale_string(basic.get("lastName")),
            ] if n
        ).strip(),
        "email": basic.get("email") or payload.get("email") or "",
        "profile_url": basic.get("profileUrl") or "",
        "headline": _locale_string(basic.get("headline")),
        "education": {
            "school": _locale_string(edu.get("schoolName")),
            "degree": _locale_string(edu.get("degreeName")),
            "verified_tier": bool(edu),
        } if edu else {"school": "", "degree": "", "verified_tier": False},
    }


async def fetch_linkedin_identity(access_token: str) -> Optional[Dict]:
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            f"{settings.LINKEDIN_API_BASE}{settings.LINKEDIN_IDENTITY_PATH}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "LinkedIn-Version": settings.LINKEDIN_API_VERSION,
            },
        )
    if resp.status_code != 200:
        logger.warning("LinkedIn identity fetch failed: %s", resp.text[:300])
        return None
    try:
        return parse_identity(resp.json())
    except Exception as e:
        logger.warning("LinkedIn identity parse failed: %s", e)
        return None


def education_identity_boost(identity: Dict, current: float) -> float:
    """Education → identity consistency (capped, documented).

    Verified-tier education (Plus scope returned a school) lifts identity to
    at least 0.85; a bare LinkedIn profile link lifts to at least 0.65.
    Never lowers — LinkedIn absence must not punish thin files.
    """
    edu = (identity or {}).get("education") or {}
    if edu.get("school"):
        return max(float(current or 0.5), 0.85)
    if (identity or {}).get("profile_url") or (identity or {}).get("name"):
        return max(float(current or 0.5), 0.65)
    return float(current or 0.5)
