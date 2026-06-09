import httpx
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

router = APIRouter(prefix="/paypal", tags=["paypal"])

PAYPAL_CLIENT_ID     = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
PAYPAL_REDIRECT_URI  = os.getenv("PAYPAL_REDIRECT_URI")
PAYPAL_BASE          = "https://api-m.paypal.com"   # use sandbox: api-m.sandbox.paypal.com for testing

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


class CodePayload(BaseModel):
    code: str


@router.post("/exchange-token")
async def exchange_token(payload: CodePayload):
    """Exchange OAuth code for access token, then pull transactions."""
    async with httpx.AsyncClient() as client:
        # 1. Get access token
        token_res = await client.post(
            f"{PAYPAL_BASE}/v1/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": payload.code,
                "redirect_uri": PAYPAL_REDIRECT_URI,
            },
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        )
        if token_res.status_code != 200:
            raise HTTPException(400, detail="PayPal token exchange failed")

        tokens = token_res.json()
        access_token = tokens["access_token"]

        # 2. Get PayPal user info
        user_res = await client.get(
            f"{PAYPAL_BASE}/v1/identity/openidconnect/userinfo?schema=openid",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_info = user_res.json()
        paypal_user_id = user_info.get("user_id") or user_info.get("sub")

        # 3. Save tokens to Supabase
        supabase.table("paypal_connections").upsert({
            "paypal_user_id": paypal_user_id,
            "access_token": access_token,
            "refresh_token": tokens.get("refresh_token"),
            "email": user_info.get("email"),
        }).execute()

        # 4. Pull transactions in background
        await pull_transactions(paypal_user_id, access_token)

        return {"success": True, "user_id": paypal_user_id}


async def pull_transactions(paypal_user_id: str, access_token: str):
    """Fetch last 24 months of transactions and store in Supabase."""
    from datetime import datetime, timedelta

    end_date   = datetime.utcnow()
    start_date = end_date - timedelta(days=730)

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{PAYPAL_BASE}/v1/reporting/transactions",
            params={
                "start_date": start_date.strftime("%Y-%m-%dT00:00:00-0700"),
                "end_date":   end_date.strftime("%Y-%m-%dT23:59:59-0700"),
                "fields": "all",
                "page_size": 500,
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if res.status_code != 200:
            return  # log and continue gracefully

        data = res.json()
        transactions = data.get("transaction_details", [])

        rows = []
        for txn in transactions:
            info = txn.get("transaction_info", {})
            rows.append({
                "paypal_user_id": paypal_user_id,
                "transaction_id": info.get("transaction_id"),
                "amount":         float(info.get("transaction_amount", {}).get("value", 0)),
                "currency":       info.get("transaction_amount", {}).get("currency_code"),
                "status":         info.get("transaction_status"),
                "date":           info.get("transaction_initiation_date"),
                "type":           info.get("transaction_event_code"),
            })

        if rows:
            supabase.table("paypal_transactions").upsert(rows).execute()