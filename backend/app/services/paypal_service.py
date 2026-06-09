import httpx
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from app.core.config import get_settings
import base64

settings = get_settings()


# ✅ STEP 1 — Generate PayPal OAuth URL (FIXED)
def get_paypal_auth_url(state: str) -> str:
    """Returns the PayPal OAuth authorization URL."""

    return (
        f"https://www.sandbox.paypal.com/signin/authorize"
        f"?client_id={settings.PAYPAL_CLIENT_ID}"
        f"&response_type=code"
        f"&scope=openid profile email https://uri.paypal.com/services/reporting/search/read"
        f"&redirect_uri={settings.PAYPAL_REDIRECT_URI}"
        f"&state={state}"
    )


# ✅ STEP 2 — Exchange code for access token
async def exchange_paypal_code(code: str) -> Optional[Dict]:
    """Exchange authorization code for access token."""

    credentials = base64.b64encode(
        f"{settings.PAYPAL_CLIENT_ID}:{settings.PAYPAL_CLIENT_SECRET}".encode()
    ).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.PAYPAL_BASE_URL}/v1/oauth2/token",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.PAYPAL_REDIRECT_URI,
            },
        )

    if resp.status_code != 200:
        print("❌ PayPal token exchange failed:", resp.text)
        return None

    return resp.json()


# ✅ STEP 3 — Fetch PayPal profile
async def fetch_paypal_profile(access_token: str) -> Optional[Dict]:
    """Fetch user profile from PayPal."""

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.PAYPAL_BASE_URL}/v1/identity/openidconnect/userinfo?schema=openid",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if resp.status_code != 200:
        print("❌ Profile fetch failed:", resp.text)
        return None

    data = resp.json()

    return {
        "name": data.get("name", ""),
        "email": data.get("email", ""),
        "payer_id": data.get("payer_id", ""),
    }


# ✅ STEP 4 — Fetch transactions
async def fetch_paypal_transactions(access_token: str, months: int = 24) -> List[Dict]:
    """Fetch transaction history from PayPal."""

    transactions = []
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=months * 30)

    async with httpx.AsyncClient() as client:
        page = 1

        while True:
            resp = await client.get(
                f"{settings.PAYPAL_BASE_URL}/v1/reporting/transactions",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "start_date": start_date.strftime("%Y-%m-%dT00:00:00Z"),
                    "end_date": end_date.strftime("%Y-%m-%dT23:59:59Z"),
                    "transaction_status": "S",
                    "fields": "all",
                    "page_size": 200,
                    "page": page,
                },
            )

            if resp.status_code != 200:
                print("❌ Transaction fetch failed:", resp.text)
                break

            data = resp.json()
            items = data.get("transaction_details", [])

            transactions.extend(items)

            if page >= data.get("total_pages", 1):
                break

            page += 1

    return _normalise_paypal_transactions(transactions)


# ✅ STEP 5 — Normalize data
def _normalise_paypal_transactions(raw: List[Dict]) -> List[Dict]:
    """Convert raw PayPal transactions to clean format."""

    normalised = []

    for tx in raw:
        info = tx.get("transaction_info", {})
        amount = info.get("transaction_amount", {})

        normalised.append({
            "transaction_id": info.get("transaction_id"),
            "date": info.get("transaction_initiation_date", "")[:10],
            "amount_usd": float(amount.get("value", 0)),
            "currency": amount.get("currency_code", "USD"),
            "type": info.get("transaction_event_code", ""),
            "status": info.get("transaction_status", ""),
            "counterparty": tx.get("payer_info", {}).get("payer_name", {}).get("full_name", ""),
            "note": info.get("transaction_note", ""),
        })

    return normalised