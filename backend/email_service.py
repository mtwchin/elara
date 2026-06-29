import os

def send_email(to_email: str, subject: str, body: str):
    """
    Send an email using a transactional email provider.
    (Mocked for this implementation, would typically use SendGrid, Resend, or AWS SES)
    """
    # Here we would normally use a provider SDK (e.g. sendgrid, resend)
    print(f"Mock sending email to: {to_email}")
    print(f"Subject: {subject}")
    print(f"Body: {body}")
    
    return {"status": "success", "to": to_email}
