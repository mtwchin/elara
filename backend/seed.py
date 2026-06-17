import datetime
from database import SessionLocal, engine, Base
from models import Property, Tenant, Transaction, User
from auth import hash_password

# Create the tables
Base.metadata.create_all(bind=engine)

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"


def seed_db():
    db = SessionLocal()

    if not db.query(User).filter(User.email == DEMO_EMAIL).first():
        db.add(User(email=DEMO_EMAIL, hashed_password=hash_password(DEMO_PASSWORD)))
        db.commit()
        print(f"Seeded demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")

    # Check if we already have data
    if db.query(Property).first():
        print("Database already seeded.")
        return

    # Create Properties
    prop1 = Property(
        address="123 Main St, Springfield, IL",
        property_type="Single Family",
        purchase_price=250000.0,
        purchase_date=datetime.date(2020, 5, 15),
        status="Active"
    )
    
    prop2 = Property(
        address="456 Elm St, Springfield, IL",
        property_type="Multi Family",
        purchase_price=500000.0,
        purchase_date=datetime.date(2021, 8, 10),
        status="Under Maintenance"
    )

    db.add(prop1)
    db.add(prop2)
    db.commit()
    db.refresh(prop1)
    db.refresh(prop2)

    # Create Tenants
    tenant1 = Tenant(
        name="John Doe",
        email="john.doe@example.com",
        phone="555-0100",
        property_id=prop1.id,
        lease_start=datetime.date(2025, 8, 1),
        lease_end=datetime.date(2026, 7, 31),
        rent_amount=1500.0,
        intent="Renewing"
    )

    tenant2 = Tenant(
        name="Jane Smith",
        email="jane.smith@example.com",
        phone="555-0101",
        property_id=prop2.id,
        lease_start=datetime.date(2025, 6, 1),
        lease_end=datetime.date(2026, 5, 31),
        rent_amount=1200.0,
        intent="Moving Out / Notice Given"
    )

    db.add(tenant1)
    db.add(tenant2)
    db.commit()

    # Create Transactions
    t1 = Transaction(
        property_id=prop1.id,
        transaction_date=datetime.date(2026, 6, 1),
        amount=1500.0,
        category="Rent",
        type="income",
        description="June Rent",
        status="Paid"
    )

    t2 = Transaction(
        property_id=prop1.id,
        transaction_date=datetime.date(2026, 6, 15),
        amount=250.0,
        category="Maintenance",
        type="expense",
        description="Plumbing repair",
        status="Paid"
    )

    t3 = Transaction(
        property_id=prop2.id,
        transaction_date=datetime.date(2026, 2, 1),
        amount=1200.0,
        category="Rent",
        type="income",
        description="February Rent - Apt A",
        status="Unpaid"
    )

    db.add(t1)
    db.add(t2)
    db.add(t3)
    db.commit()

    print("Database seeded successfully.")

if __name__ == "__main__":
    seed_db()
