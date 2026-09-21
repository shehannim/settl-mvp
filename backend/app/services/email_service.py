"""Server-side email delivery (Resend API over HTTPS).

Render's free tier blocks SMTP, so all mail goes through Resend's HTTPS API.
If RESEND_API_KEY is unset, sending raises EmailNotConfigured — routers turn
that into a clear 503 instead of pretending delivery happened.
"""
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_HTTP_TIMEOUT = httpx.Timeout(15.0, connect=10.0)


class EmailNotConfigured(Exception):
    pass


def _sender() -> str:
    sender = settings.RESEND_FROM or ""
    if not settings.RESEND_API_KEY or not sender:
        raise EmailNotConfigured(
            "Email delivery is not configured. Set RESEND_API_KEY and "
            "RESEND_FROM (a verified sender) on the backend."
        )
    return sender


async def send_otp_email(to_email: str, otp: str, purpose: str = "verification") -> None:
    """Sends a 6-digit OTP. Never logs the OTP value."""
    sender = _sender()
    subject = {
        "verification": "Your Settl verification code",
        "kyc": "Your Settl identity verification code",
    }.get(purpose, "Your Settl verification code")

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": sender,
                "to": [to_email],
                "subject": subject,
                "text": (
                    f"Your Settl {purpose} code is: {otp}\n\n"
                    "It expires in 10 minutes. If you didn't request this, ignore this email."
                ),
            },
        )
    if resp.status_code not in (200, 201, 202):
        logger.warning("Resend delivery failed: %s", resp.text[:300])
        raise RuntimeError("Email delivery failed, please try again.")
    logger.info("OTP email sent purpose=%s to=%s", purpose, (to_email[:2] + "***"))
