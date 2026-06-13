import re
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Tuple
import os

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
        if not (1900 <= year <= 2010):
            return False, "Invalid birth year in NIC"
        return True, ""

    if re.match(r"^\d{9}[VX]$", nic):
        return True, ""

    if re.match(r"^\d{9}$", nic):
        return False, "Old format NIC must end with V or X (e.g. 900123456V)"
    if re.match(r"^\d{10,11}$", nic):
        return False, "Invalid NIC format — use 9 digits + V/X or 12 digits"

    return False, "Invalid NIC format. Use 900123456V or 199012345678"


def generate_otp(user_id: str, email: str) -> str:
    otp = str(random.randint(100000, 999999))
    _otp_store[user_id] = {
        "otp": otp,
        "created_at": datetime.utcnow(),
        "attempts": 0
    }
    _send_otp_email(email, otp)
    return otp


def _send_otp_email(to_email: str, otp: str):
    sender = os.getenv("EMAIL_ADDRESS")
    password = os.getenv("EMAIL_PASSWORD")

    if not sender or not password:
        print(f"[DEV] OTP for {to_email}: {otp}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Settl Verification Code"
    msg["From"] = f"Settl <{sender}>"
    msg["To"] = to_email

    text = f"""
Your Settl verification code is:

{otp}

This code expires in 10 minutes.
Do not share this code with anyone.
"""

    html = f"""
<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #34d399;">Settl</h2>
  <p style="color: #666;">Your verification code is:</p>
  <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #111; margin: 20px 0;">
    {otp}
  </div>
  <p style="color: #999; font-size: 13px;">This code expires in 10 minutes. Do not share it with anyone.</p>
</div>
"""

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(sender, password)
            smtp.sendmail(sender, to_email, msg.as_string())
            print(f"OTP email sent to {to_email}")
    except Exception as e:
        print(f"Email send failed: {e}")


def verify_otp(user_id: str, code: str) -> Tuple[bool, str]:
    """
    Verifies OTP for a user.
    Returns (is_valid, error_message)
    """
    record = _otp_store.get(user_id)

    if not record:
        return False, "No OTP found. Please request a new code."

    if record["attempts"] >= 3:
        del _otp_store[user_id]
        return False, "Too many attempts. Please request a new code."

    elapsed = (datetime.utcnow() - record["created_at"]).seconds
    if elapsed > 600:
        del _otp_store[user_id]
        return False, "OTP has expired. Please request a new code."

    _otp_store[user_id]["attempts"] += 1

    if record["otp"] != code:
        remaining = 3 - _otp_store[user_id]["attempts"]
        return False, f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."

    del _otp_store[user_id]
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