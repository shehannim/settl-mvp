import re
import random
import string
from datetime import datetime
from typing import Tuple

# Demo OTP — in production this would call Dialog/Mobitel SMS API
DEMO_OTP = "123456"

# Store OTPs in memory for demo (use Redis in production)
_otp_store: dict = {}


def validate_nic(nic: str) -> Tuple[bool, str]:
    """
    Validates Sri Lankan NIC format.
    Old format: 9 digits + V or X (e.g. 900123456V)
    New format: 12 digits (e.g. 199012345678)
    Returns (is_valid, error_message)
    """
    nic = nic.strip().upper()

    # New format: 12 digits
    if re.match(r"^\d{12}$", nic):
        # Validate birth year is plausible (1900-2010)
        year = int(nic[:4])
        if not (1900 <= year <= 2010):
            return False, "Invalid birth year in NIC"
        return True, ""

    # Old format: 9 digits + V or X
    if re.match(r"^\d{9}[VX]$", nic):
        return True, ""

    # Common mistakes
    if re.match(r"^\d{9}$", nic):
        return False, "Old format NIC must end with V or X (e.g. 900123456V)"
    if re.match(r"^\d{10,11}$", nic):
        return False, "Invalid NIC format — use 9 digits + V/X or 12 digits"

    return False, "Invalid NIC format. Use 900123456V or 199012345678"


def generate_otp(user_id: str) -> str:
    """
    In demo mode: always returns 123456.
    In production: generate random 6-digit OTP and send via Dialog/Mobitel API.
    """
    # For demo — always use 123456
    otp = DEMO_OTP
    _otp_store[user_id] = {
        "otp": otp,
        "created_at": datetime.utcnow(),
        "attempts": 0
    }
    return otp


def verify_otp(user_id: str, code: str) -> Tuple[bool, str]:
    """
    Verifies OTP for a user.
    Returns (is_valid, error_message)
    """
    record = _otp_store.get(user_id)

    if not record:
        return False, "No OTP found. Please request a new code."

    # Check attempts
    if record["attempts"] >= 3:
        del _otp_store[user_id]
        return False, "Too many attempts. Please request a new code."

    # Check expiry (10 minutes)
    elapsed = (datetime.utcnow() - record["created_at"]).seconds
    if elapsed > 600:
        del _otp_store[user_id]
        return False, "OTP has expired. Please request a new code."

    # Increment attempts
    _otp_store[user_id]["attempts"] += 1

    if record["otp"] != code:
        remaining = 3 - _otp_store[user_id]["attempts"]
        return False, f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."

    # Valid — clean up
    del _otp_store[user_id]
    return True, ""


def fuzzy_name_match(name1: str, name2: str) -> float:
    """
    Simple fuzzy name matching.
    Returns similarity score 0.0–1.0.
    In production: use python-Levenshtein or rapidfuzz.
    """
    # Normalise both names
    def normalise(n):
        return set(n.upper().replace(".", " ").replace("-", " ").split())

    parts1 = normalise(name1)
    parts2 = normalise(name2)

    if not parts1 or not parts2:
        return 0.0

    # Jaccard similarity
    intersection = len(parts1 & parts2)
    union = len(parts1 | parts2)
    return intersection / union if union > 0 else 0.0
