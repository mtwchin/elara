import os
import logging
import stripe
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("elara.billing")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

PLAN_PRICE_ENV_VARS = {
    "Starter": "STRIPE_PRICE_ID_STARTER",
    "Portfolio": "STRIPE_PRICE_ID_PORTFOLIO",
    "Operator": "STRIPE_PRICE_ID_OPERATOR",
}


def is_stripe_configured() -> bool:
    return bool(stripe.api_key)


def configured_tiers() -> list[str]:
    if not is_stripe_configured():
        return []
    return [tier for tier, env_name in PLAN_PRICE_ENV_VARS.items() if os.environ.get(env_name)]


def normalize_tier(tier: str | None) -> str:
    requested = (tier or "Portfolio").strip().lower()
    aliases = {
        "basic": "Starter",
        "starter": "Starter",
        "pro": "Portfolio",
        "portfolio": "Portfolio",
        "growth": "Portfolio",
        "operator": "Operator",
        "enterprise": "Operator",
    }
    return aliases.get(requested, "Portfolio")


def create_checkout_session(user_id: int, user_email: str, tier: str, success_url: str, cancel_url: str):
    """
    Create a Stripe Checkout Session for a given user and subscription tier.
    """
    if not stripe.api_key:
        raise RuntimeError("STRIPE_SECRET_KEY is not configured")

    normalized_tier = normalize_tier(tier)
    price_id = os.environ.get(PLAN_PRICE_ENV_VARS[normalized_tier])
    if not price_id:
        raise RuntimeError(f"Stripe price is not configured for tier '{normalized_tier}'")
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user_email,
            client_reference_id=str(user_id),
            metadata={
                "user_id": str(user_id),
                "tier": normalized_tier,
            },
            subscription_data={
                "metadata": {
                    "user_id": str(user_id),
                    "tier": normalized_tier,
                },
            },
        )
        return session.url
    except Exception:
        logger.exception("Error creating Stripe checkout session")
        raise

def handle_webhook_event(payload: bytes, sig_header: str):
    """
    Verify and process a Stripe webhook event.
    """
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not configured")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        return event
    except ValueError as e:
        # Invalid payload
        raise e
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise e


def create_customer_portal_session(customer_id: str, return_url: str):
    """
    Create a Stripe Billing Portal session for subscription management.
    """
    if not stripe.api_key:
        raise RuntimeError("STRIPE_SECRET_KEY is not configured")
    if not customer_id:
        raise RuntimeError("Stripe customer is not configured for this user")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session.url
    except Exception:
        logger.exception("Error creating Stripe customer portal session")
        raise
