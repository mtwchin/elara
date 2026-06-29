import os
import stripe
from dotenv import load_dotenv

load_dotenv()

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

def create_checkout_session(user_id: int, user_email: str, tier: str, success_url: str, cancel_url: str):
    """
    Create a Stripe Checkout Session for a given user and subscription tier.
    """
    # Note: In a real app, you would have logic here to map the tier to a Stripe Price ID
    price_id = "price_dummy_123" # e.g. os.environ.get(f"STRIPE_PRICE_ID_{tier.upper()}")
    
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
        )
        return session.url
    except Exception as e:
        print(f"Error creating checkout session: {e}")
        return None

def handle_webhook_event(payload: bytes, sig_header: str):
    """
    Verify and process a Stripe webhook event.
    """
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
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
