"""Seed realistic freelancer payout history between PayPal SANDBOX accounts.

USE SANDBOX CREDENTIALS ONLY — never your live PayPal keys or password.
Run it yourself so secrets never leave your machine:

    $env:PAYPAL_SANDBOX_CLIENT_ID="..."
    $env:PAYPAL_SANDBOX_CLIENT_SECRET="..."
    python scripts/seed_paypal_sandbox.py --receiver sb-personal@example.com --count 40 --dry-run
    python scripts/seed_paypal_sandbox.py --receiver sb-personal@example.com --count 40

What it does: sends --count payouts (USD 80–900, Fiverr/Upwork-style notes)
from your sandbox business account to your sandbox personal account via the
sandbox Payouts API. Those land in sandbox reporting, so Settl's PayPal
connect pulls real API data in the demo.

Honest limitation: the Payouts API executes immediately, so it CANNOT
backdate — all seeded payouts land "today" (high count, short history).
The scoring engine treats that as thin-file: expect modest history scores.
Do NOT fake dates; judges probe this.
"""
import argparse
import base64
import os
import random
import sys
import uuid

import httpx

BASE_URL = os.getenv("PAYPAL_SANDBOX_BASE_URL", "https://api-m.sandbox.paypal.com")

NOTES = [
    "Fiverr order payout",
    "Upwork contract payment",
    "Fiverr gig payout",
    "Freelancer milestone payment",
    "Upwork bonus payout",
    "Direct client payment",
]


def build_batch(receiver: str, count: int, seed: int) -> dict:
    rng = random.Random(seed)
    items = []
    for _ in range(count):
        # Skewed like real freelance income: many small gigs, few big ones.
        amount = round(rng.choice([
            rng.uniform(80, 250),
            rng.uniform(80, 250),
            rng.uniform(250, 500),
            rng.uniform(500, 900),
        ]), 2)
        items.append({
            "recipient_type": "EMAIL",
            "receiver": receiver,
            "amount": {"value": f"{amount:.2f}", "currency": "USD"},
            "note": rng.choice(NOTES),
            "sender_item_id": f"settl-seed-{uuid.uuid4().hex[:8]}",
        })
    return {
        "sender_batch_header": {
            "sender_batch_id": f"settl-{uuid.uuid4().hex[:12]}",
            "email_subject": "Settl demo payout",
        },
        "items": items,
    }


def get_token(client_id: str, secret: str) -> str:
    creds = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
    resp = httpx.post(
        f"{BASE_URL}/v1/oauth2/token",
        headers={
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
        timeout=20.0,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed PayPal sandbox payouts.")
    parser.add_argument("--receiver", required=True,
                        help="Receiver SANDBOX personal account email")
    parser.add_argument("--count", type=int, default=40,
                        help="Number of payouts to send (default 40)")
    parser.add_argument("--seed", type=int, default=42,
                        help="RNG seed for reproducible amounts")
    parser.add_argument("--dry-run", action="store_true",
                        help="Build and print the batch without sending")
    args = parser.parse_args()

    batch = build_batch(args.receiver, args.count, args.seed)
    total = sum(float(i["amount"]["value"]) for i in batch["items"])
    print(f"Batch {batch['sender_batch_header']['sender_batch_id']}: "
          f"{len(batch['items'])} payouts, total ${total:,.2f} to {args.receiver}")

    if args.dry_run:
        print("DRY RUN — first item:", batch["items"][0])
        print("DRY RUN — nothing sent.")
        return 0

    client_id = os.getenv("PAYPAL_SANDBOX_CLIENT_ID")
    secret = os.getenv("PAYPAL_SANDBOX_CLIENT_SECRET")
    if not client_id or not secret:
        print("ERROR: set PAYPAL_SANDBOX_CLIENT_ID and PAYPAL_SANDBOX_CLIENT_SECRET env vars.",
              file=sys.stderr)
        print("Get them from developer.paypal.com → your sandbox app (keys are regenerable).",
              file=sys.stderr)
        return 2

    token = get_token(client_id, secret)
    resp = httpx.post(
        f"{BASE_URL}/v1/payments/payouts",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=batch,
        timeout=30.0,
    )
    if resp.status_code not in (201, 200):
        print(f"Payouts API failed ({resp.status_code}): {resp.text[:500]}", file=sys.stderr)
        return 1

    data = resp.json()
    print(f"Submitted. batch_id={data.get('batch_header', {}).get('payout_batch_id')}")
    print("Check sandbox.paypal.com → receiver account, then reconnect PayPal in Settl.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
