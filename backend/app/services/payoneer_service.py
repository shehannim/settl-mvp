"""Payoneer income-source integration (mirrors paypal_service.py).

Flow: OAuth2 authorization-code (partner credentials from
developer.payoneer.com) → access token → account balances + transactions →
normalised monthly income for the scoring engine.

Sandbox:
  auth:  https://login.sandbox.payoneer.com/api/v2/oauth2/authorize
  api:   https://api.sandbox.payoneer.com
Live hosts are set via PAYONEER_AUTH_URL / PAYONEER_BASE_URL env vars.

NOTE: Payoneer issues client credentials to registered partners, unlike
PayPal's self-serve sandbox. Until credentials are issued, the frontend
falls back to Payoneer statement upload; this service activates as soon as
PAYONEER_CLIENT_ID/SECRET are configured.
"""
import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_HTTP_TIMEOUT = httpx.Timeout(15.0, connect=10.0)

# Read-only scopes for income verification — never request payout scopes.
SCOPES = "openid profile email account:balances:read account:transactions:read"


def is_configured() -> bool:
    return bool(settings.PAYONEER_CLIENT_ID and settings.PAYONEER_CLIENT_SECRET)


def get_payoneer_auth_url(state: str) -> str:
    """Returns the Payoneer OAuth authorization URL (purpose-bound state)."""
    params = urlencode({
        "client_id": settings.PAYONEER_CLIENT_ID,
        "response_type": "code",
        "scope": SCOPES,
        "redirect_uri": settings.PAYONEER_REDIRECT_URI,
        "state": state,
    })
    return f"{settings.PAYONEER_AUTH_URL}?{params}"


async def exchange_payoneer_code(code: str) -> Optional[Dict]:
    """Exchange authorization code for access token."""
    credentials = base64.b64encode(
        f"{settings.PAYONEER_CLIENT_ID}:{settings.PAYONEER_CLIENT_SECRET}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.post(
            f"{settings.PAYONEER_BASE_URL}/api/v2/oauth2/token",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.PAYONEER_REDIRECT_URI,
            },
        )

    if resp.status_code != 200:
        logger.warning("Payoneer token exchange failed: %s", resp.text[:300])
        return None

    return resp.json()


async def fetch_payoneer_profile(access_token: str) -> Optional[Dict]:
    """Fetch account-holder profile (name/email) from Payoneer."""
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            f"{settings.PAYONEER_BASE_URL}/api/v2/account/details",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if resp.status_code != 200:
        logger.warning("Payoneer profile fetch failed: %s", resp.text[:300])
        return None

    data = resp.json()
    return {
        "name": data.get("accountHolderName") or data.get("name", ""),
        "email": data.get("email", ""),
        "account_id": data.get("accountId") or data.get("payeeId", ""),
    }


async def fetch_payoneer_transactions(
    access_token: str, account_id: str = "", months: int = 24
) -> List[Dict]:
    """Fetch transaction history, paginated, then normalise.

    Dates use ISO-8601 with explicit UTC day boundaries.
    """
    transactions: List[Dict] = []
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=months * 30)

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        page = 1
        while True:
            resp = await client.get(
                f"{settings.PAYONEER_BASE_URL}/api/v2/account/transactions",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "accountId": account_id,
                    "startDate": start_date.strftime("%Y-%m-%dT00:00:00Z"),
                    "endDate": end_date.strftime("%Y-%m-%dT23:59:59Z"),
                    "pageSize": 200,
                    "page": page,
                },
            )

            if resp.status_code != 200:
                logger.warning("Payoneer transaction fetch failed: %s", resp.text[:300])
                break

            data = resp.json()
            items = data.get("transactions") or data.get("transactionDetails") or []
            transactions.extend(items)

            total_pages = data.get("totalPages", 1)
            if page >= total_pages:
                break
            page += 1

    return _normalise_payoneer_transactions(transactions)


def _normalise_payoneer_transactions(raw: List[Dict]) -> List[Dict]:
    """Convert raw Payoneer transactions to the shared income-tx shape.

    Amounts stay in native currency ({amount, currency}); conversion to USD
    happens in normalisation_service.convert_to_usd so multi-currency
    Payoneer balances (USD/EUR/GBP/...) are handled centrally.
    """
    normalised = []

    for tx in raw:
        amount_block = tx.get("amount") or {}
        if isinstance(amount_block, (int, float)):
            amount, currency = float(amount_block), tx.get("currency", "USD")
        else:
            amount = float(amount_block.get("value", 0))
            currency = amount_block.get("currencyCode") or amount_block.get("currency", "USD")

        date_raw = (
            tx.get("transactionDate")
            or tx.get("initiationDate")
            or tx.get("date", "")
        )

        normalised.append({
            "transaction_id": tx.get("transactionId") or tx.get("id"),
            "date": str(date_raw)[:10],
            "amount": amount,
            "amount_usd": amount if currency == "USD" else None,
            "currency": currency,
            "type": tx.get("transactionType") or tx.get("type", ""),
            "status": tx.get("status", ""),
            "counterparty": tx.get("counterparty") or tx.get("payerName", ""),
            "note": tx.get("description") or tx.get("note", ""),
        })

    return normalised
