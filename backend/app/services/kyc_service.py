import re
import logging
import random
import secrets
from datetime import datetime, timezone
from typing import Tuple

logger = logging.getLogger(__name__)

_otp_store: dict = {}


def validate_nic(nic: str) -> Tuple[bool, str]:
    """
    Validates Sri Lankan NIC format.
    Old format: 9 digits + V or X (e.g. 900123456V)
    New format: 12 digits (e.g. 199012345678)
    Returns (is_valid, error_message)
    """
    nic = nic.strip().upper()

    if re.match(r"^\d{12}$", nic):
        year = int(nic[:4])
        current_year = datetime.now(timezone.utc).year
        if not (1900 <= year <= current_year):
            return False, "Invalid birth year in NIC"
        return True, ""

    if re.match(r"^\d{9}[VX]$", nic):
        return True, ""

    if re.match(r"^\d{9}$", nic):
        return False, "Old format NIC must end with V or X (e.g. 900123456V)"
    if re.match(r"^\d{10,11}$", nic):
        return False, "Invalid NIC format — use 9 digits + V/X or 12 digits"

    return False, "Invalid NIC format. Use 900123456V or 199012345678"


def _otp_key(user_id: str, slot: str = "kyc") -> str:
    return f"{slot}:{user_id}"


def generate_otp(user_id: str, email: str = None, slot: str = "kyc") -> str:
    # secrets = CSPRNG (random.randint is predictable). Never log the OTP value.
    # slot separates independent flows (kyc vs signup email) sharing one store.
    # DEMO SWITCH: OTP_FIXED_CODE forces every code (e.g. "000000" for demo
    # day). Unset it for real randomness. Expiry + attempt limits still apply.
    import os as _os
    fixed = (_os.getenv("OTP_FIXED_CODE") or "").strip()
    otp = fixed if len(fixed) == 6 and fixed.isdigit() else f"{secrets.randbelow(900000) + 100000:06d}"
    _otp_store[_otp_key(user_id, slot)] = {
        "otp": otp,
        "created_at": datetime.now(timezone.utc),
        "attempts": 0
    }
    # Email delivery must happen server-side (see routers/kyc.py).
    # Only log that an OTP was issued, never the value.
    logger.info("OTP issued slot=%s user_id=%s", slot, user_id[:8] + "...")
    return otp


def verify_otp(user_id: str, code: str, slot: str = "kyc") -> Tuple[bool, str]:
    """
    Verifies OTP for a user.
    Returns (is_valid, error_message)
    """
    key = _otp_key(user_id, slot)
    record = _otp_store.get(key)

    if not record:
        return False, "No OTP found. Please request a new code."

    if record["attempts"] >= 3:
        del _otp_store[key]
        return False, "Too many attempts. Please request a new code."

    created = record["created_at"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - created).total_seconds()
    if elapsed > 600:
        del _otp_store[key]
        return False, "OTP has expired. Please request a new code."

    _otp_store[key]["attempts"] += 1

    if record["otp"] != code:
        remaining = 3 - _otp_store[key]["attempts"]
        return False, f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."

    del _otp_store[key]
    return True, ""


def fuzzy_name_match(name1: str, name2: str) -> float:
    """
    Simple fuzzy name matching.
    Returns similarity score 0.0–1.0.
    """
    def normalise(n):
        return set(n.upper().replace(".", " ").replace("-", " ").split())

    parts1 = normalise(name1)
    parts2 = normalise(name2)

    if not parts1 or not parts2:
        return 0.0

    intersection = len(parts1 & parts2)
    union = len(parts1 | parts2)
    return intersection / union if union > 0 else 0.0