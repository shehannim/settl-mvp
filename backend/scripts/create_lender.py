"""Provision a real lender account (admin tool — replaces demo logins).

Usage (SUPABASE_URL + SUPABASE_SERVICE_KEY in env):
    python scripts/create_lender.py --email credit@financeco.lk \\
        --password 'StrongPass!9' --institution 'Finance Co PLC' \\
        --min-score 650 --min-confidence 0.6

The lender then signs in at the lender portal with that email + password.
Passwords are bcrypt-hashed; never stored or logged in plain text.
"""
import argparse
import os
import sys
import uuid

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main() -> int:
    parser = argparse.ArgumentParser(description="Provision a lender account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--institution", required=True)
    parser.add_argument("--min-score", type=int, default=650)
    parser.add_argument("--min-confidence", type=float, default=0.6)
    args = parser.parse_args()

    if len(args.password) < 8:
        print("ERROR: password must be at least 8 characters.", file=sys.stderr)
        return 2

    from supabase import create_client
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required.", file=sys.stderr)
        return 2
    db = create_client(url, key)

    email = args.email.lower().strip()
    existing = db.table("lenders").select("id").eq("email", email).execute()
    if existing.data:
        print(f"Lender {email} already exists — password updated.")
        db.table("lenders").update({
            "password_hash": pwd_context.hash(args.password[:72]),
            "institution_name": args.institution,
            "min_score": args.min_score,
            "min_confidence": args.min_confidence,
        }).eq("email", email).execute()
        return 0

    db.table("lenders").insert({
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": pwd_context.hash(args.password[:72]),
        "institution_name": args.institution,
        "min_score": args.min_score,
        "min_confidence": args.min_confidence,
    }).execute()
    print(f"Lender {email} ({args.institution}) provisioned.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
