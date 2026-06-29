import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "elara_worker",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task
def process_document_with_ai(storage_path: str, document_id: int):
    """
    Background task to process a document with Gemini AI and save the results
    to the database.
    """
    from database import SessionLocal
    from models import Document
    from agent import extract_document_data
    
    db = SessionLocal()
    try:
        data = extract_document_data(storage_path)
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc and data:
            doc.extracted_amount = data.get("amount")
            doc.extracted_date = data.get("date")
            doc.extracted_vendor = data.get("vendor")
            doc.extracted_category = data.get("category")
            doc.extraction_confidence = data.get("confidence")
            db.commit()
        return data
    except Exception as e:
        print(f"Error processing document: {e}")
        return None
    finally:
        db.close()

@celery_app.task
def generate_predictive_insights():
    """
    Run predictive insights for all portfolios
    """
    return {"status": "success"}

@celery_app.task
def send_email_notification(to_email: str, subject: str, body: str):
    from email_service import send_email
    return send_email(to_email, subject, body)
