"""Seed 3 full-detail demo users (struggling / stable / exceptional).

Each user is REGISTERED FOR REAL via the API, then given profile data,
income sources and verified bills matching frontend/src/data/demoProfiles.js,
and finally scored through the REAL /api/score/compute engine — so the
dashboard shows genuine computed scores and the logins work in the demo video.

Customer side may show full details (user's own data); the anonymized
DemoProfiles viewer stays PII-free for public display.

Usage (backend running + Supabase env available):
    $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_KEY="..."
    python scripts/seed_demo_users.py [--api http://localhost:8000] [--dry-run]

Credentials (all three): password Demo@1234
    kasun.f.demo@settl-demo.com  (struggling)
    sanduni.p.demo@settl-demo.com (stable)
    ayesha.r.demo@settl-demo.com  (exceptional)
"""
import argparse
import os
import sys
import uuid
from datetime import datetime, timezone

import httpx

API_DEFAULT = "http://localhost:8000"
PASSWORD = "Demo@1234"

# Biller catalogue for realistic seeded bills (masked accounts, base amounts).
BILLERS = {
    "CEB": {"prefix": "CEB-41", "base": 5200},
    "SLT Fibre": {"prefix": "047", "base": 4500},
    "Dialog Postpaid": {"prefix": "077", "base": 2200},
    "NWSDB Water": {"prefix": "NWS-88", "base": 1800},
    "Dialog Mobile Prepaid": {"prefix": "077", "base": 1490},
}


def build_bill_rows(plan, end_year=2026, end_month=8):
    """Deterministic realistic bill rows.

    plan: list of (biller, on_time). Periods walk back month by month from
    end_month; amounts jitter deterministically; late bills paid 7 days
    after the due date (22nd), on-time bills on the 15th.
    """
    rows = []
    y, m = end_year, end_month
    for i, (biller, on_time) in enumerate(plan):
        cfg = BILLERS[biller]
        amount = cfg["base"] + ((i * 137 + len(biller) * 53) % 900) - 200
        period = f"01/{m:02d}/{y} - 28/{m:02d}/{y}"
        due = f"22/{m:02d}/{y}"
        paid_day = 15 if on_time else 29
        paid = f"{paid_day:02d}/{m:02d}/{y}"
        account = f"{cfg['prefix']}••••{(1000 + i * 37) % 9000 + 1000}"
        rows.append({
            "biller_detected": biller,
            "fields": [
                {"field_name": "account_number", "extracted_value": account,
                 "confidence": 1.0, "user_verified": True},
                {"field_name": "billing_period", "extracted_value": period,
                 "confidence": 1.0, "user_verified": True},
                {"field_name": "amount_due", "extracted_value": f"{amount:,.2f}",
                 "confidence": 1.0, "user_verified": True},
                {"field_name": "due_date", "extracted_value": due,
                 "confidence": 1.0, "user_verified": True},
                {"field_name": "payment_date", "extracted_value": paid,
                 "confidence": 1.0, "user_verified": True},
            ],
            "overall_confidence": 1.0,
            "identity_match_score": 0.9,
            "payment_on_time": on_time,
        })
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return rows

PERSONAS = [
    {
        "key": "struggling",
        "email": "kasun.f.demo@settl-demo.com",
        "full_name": "Kasun Fernando",
        "nic_number": "200112345678",
        "identity_consistency_score": 0.6,
        "digital_tenure_months": 9,
        "sources": [
            {"source": "paypal", "account_name": "Fiverr payouts",
             "transaction_count": 31, "date_range_months": 9,
             "income_features": {
                 "income_cv": 0.9, "income_trend_slope": -0.15,
                 "income_gap_months": 6, "income_source_count": 1,
                 "income_3m_avg": 0.15, "income_6m_avg": 0.15,
                 "income_yoy_growth": -0.2}},
        ],
        # 5 Dialog bills, 1 on time -> thin + gappy -> poor band
        "bill_plan": [("Dialog Mobile Prepaid", True)] + [
            ("Dialog Mobile Prepaid", False)] * 4,
    },
    {
        "key": "stable",
        "email": "sanduni.p.demo@settl-demo.com",
        "full_name": "Sanduni Perera",
        "nic_number": "199412345678",
        "identity_consistency_score": 0.85,
        "digital_tenure_months": 28,
        "sources": [
            {"source": "payoneer", "account_name": "Upwork payouts",
             "transaction_count": 96, "date_range_months": 28,
             "income_features": {
                 "income_cv": 0.35, "income_trend_slope": 0.05,
                 "income_gap_months": 0, "income_source_count": 2,
                 "income_3m_avg": 1.3, "income_6m_avg": 1.2,
                 "income_yoy_growth": 0.1}},
            {"source": "paypal", "account_name": "Direct clients",
             "transaction_count": 34, "date_range_months": 16,
             "income_features": {
                 "income_cv": 0.35, "income_trend_slope": 0.05,
                 "income_gap_months": 0, "income_source_count": 2,
                 "income_3m_avg": 1.3, "income_6m_avg": 1.2,
                 "income_yoy_growth": 0.1}},
        ],
        # 20 bills, 16 on time -> 0.80 -> good band (live-tuned on prod model)
        # Late ones spread across billers so no single biller looks neglected.
        "bill_plan": (
            [("CEB", True)] * 7 + [("CEB", False)]
            + [("SLT Fibre", True)] * 5 + [("SLT Fibre", False)]
            + [("Dialog Postpaid", True)] * 3 + [("Dialog Postpaid", False)]
            + [("NWSDB Water", True)] + [("NWSDB Water", False)]
        ),
    },
    {
        "key": "exceptional",
        "email": "ayesha.r.demo@settl-demo.com",
        "full_name": "Ayesha Rahman",
        "nic_number": "199012345678",
        "identity_consistency_score": 0.97,
        "digital_tenure_months": 48,
        "sources": [
            {"source": "payoneer", "account_name": "Fiverr Pro + Upwork agency",
             "transaction_count": 360, "date_range_months": 48,
             "income_features": {
                 "income_cv": 0.04, "income_trend_slope": 0.09,
                 "income_gap_months": 0, "income_source_count": 2,
                 "income_3m_avg": 6.14, "income_6m_avg": 6.02,
                 "income_yoy_growth": 0.31}},
            {"source": "paypal", "account_name": "Direct wires",
             "transaction_count": 150, "date_range_months": 40,
             "income_features": {
                 "income_cv": 0.04, "income_trend_slope": 0.09,
                 "income_gap_months": 0, "income_source_count": 2,
                 "income_3m_avg": 6.14, "income_6m_avg": 6.02,
                 "income_yoy_growth": 0.31}},
            {"source": "linkedin", "account_name": "Ayesha Rahman",
             "transaction_count": 0, "date_range_months": 0,
             "income_features": {"linkedin": {"name": "Ayesha Rahman"}}},
        ],
        # 22 bills, all on time -> 1.00 (recent 22 months shown)
        "bill_plan": (
            [("CEB", True)] * 10
            + [("SLT Fibre", True)] * 6
            + [("Dialog Postpaid", True)] * 4
            + [("NWSDB Water", True)] * 2
        ),
    },
]


def register_or_login(client: httpx.Client, persona: dict, dry: bool):
    if dry:
        print(f"  [dry] register {persona['email']}")
        return "dry-user-id", "dry-token"
    r = client.post(f"/api/auth/register", json={
        "email": persona["email"], "password": PASSWORD,
        "full_name": persona["full_name"]})
    if r.status_code == 400:  # already registered -> login
        r = client.post(f"/api/auth/login", json={
            "email": persona["email"], "password": PASSWORD})
    r.raise_for_status()
    data = r.json()
    return data["user_id"], data["access_token"]


def seed_user(client: httpx.Client, db, persona: dict, dry: bool):
    print(f"== {persona['key']} ({persona['email']})")
    user_id, token = register_or_login(client, persona, dry)

    now = datetime.now(timezone.utc).isoformat()
    if dry:
        print(f"  [dry] profile: kyc=True nic={persona['nic_number']} "
              f"identity={persona['identity_consistency_score']}")
        print(f"  [dry] {len(persona['sources'])} sources, "
              f"{len(persona['bill_plan'])} bills, then POST /score/compute")
        return

    db.table("users").update({
        "nic_number": persona["nic_number"],
        "nic_validated_at": now,
        "kyc_verified": True,
        "otp_verified": True,
        "kyc_completed_at": now,
        "connected_source_count": len(persona["sources"]),
        "digital_tenure_months": persona["digital_tenure_months"],
        "identity_consistency_score": persona["identity_consistency_score"],
        "fraud_flag_count": 0,
    }).eq("id", user_id).execute()

    for s in persona["sources"]:
        db.table("connected_sources").upsert({
            "user_id": user_id,
            "source": s["source"],
            "account_name": s["account_name"],
            "transaction_count": s["transaction_count"],
            "date_range_months": s["date_range_months"],
            "income_features": s["income_features"],
            "connected_at": now,
            "access_token_hash": "seeded-demo",
        }, on_conflict="user_id,source").execute()

    # Idempotent re-runs: clear previously seeded bills first, otherwise
    # re-seeding would stack duplicate rows and shift the score.
    if not dry:
        try:
            db.table("verified_bills").delete().eq("user_id", user_id).execute()
        except Exception as e:
            print(f"  bill cleanup warning: {e}")

    for bill in build_bill_rows(persona["bill_plan"]):
        if dry:
            continue
        db.table("verified_bills").insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "storage_path": "seeded-demo",
            "biller_detected": bill["biller_detected"],
            "fields": bill["fields"],
            "overall_confidence": bill["overall_confidence"],
            "identity_match_score": bill["identity_match_score"],
            "payment_on_time": bill["payment_on_time"],
            "confirmed_at": now,
        }).execute()

    r = client.post("/api/score/compute", json={},
                    headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    init = r.json()
    r = client.get("/api/score/result",
                   headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    res = r.json()
    print(f"  score={res['score']} band={res['band']} "
          f"confidence={res['confidence']} (compute: {init.get('score')})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed 3 demo users.")
    parser.add_argument("--api", default=API_DEFAULT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db = None
    if not args.dry_run:
        from supabase import create_client
        url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required.",
                  file=sys.stderr)
            return 2
        db = create_client(url, key)

    client = httpx.Client(base_url=args.api, timeout=60.0)
    for persona in PERSONAS:
        try:
            seed_user(client, db, persona, args.dry_run)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            return 1

    print("\nDemo logins (password for all: Demo@1234):")
    for persona in PERSONAS:
        print(f"  {persona['key']:12s} {persona['email']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
