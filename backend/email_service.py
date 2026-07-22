import logging
import os

import httpx

logger = logging.getLogger("elara.email")

RESEND_API_URL = "https://api.resend.com/emails"


def send_email(to: str, subject: str, body: str) -> None:
    """Send an HTML email via Resend.

    Falls back to logging (dev mode) when RESEND_API_KEY is absent.
    Raises RuntimeError on HTTP error from the Resend API.
    """
    api_key = os.environ.get("RESEND_API_KEY", "")
    from_addr = os.environ.get("EMAIL_FROM", "Elara <noreply@getelara.com>")

    if not api_key:
        logger.info("RESEND_API_KEY not set — email logged only (dev mode)")
        logger.info("To: %s | Subject: %s", to, subject)
        logger.info("Body: %s", body)
        return

    payload = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "html": body,
    }

    response = httpx.post(
        RESEND_API_URL,
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=10.0,
    )

    if not response.is_success:
        raise RuntimeError(
            f"Resend API error {response.status_code}: {response.text}"
        )

    logger.info("Email sent via Resend to %s (subject=%r)", to, subject)
