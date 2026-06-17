import datetime
from database import SessionLocal, engine, Base
from models import Property, Tenant, Transaction, User, Mortgage
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
        db.close()
        return

    # ------------------------------------------------------------------ #
    # Properties
    # ------------------------------------------------------------------ #
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

    # ------------------------------------------------------------------ #
    # Mortgages  (one per property — v1 constraint)
    # prop1: 30-yr fixed at 6.5%, purchase_price=$250k, down=50k → principal=200k
    # prop2: 30-yr fixed at 7.0%, purchase_price=$500k, down=100k → principal=400k
    # ------------------------------------------------------------------ #
    # Monthly P&I formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    def calc_monthly_pi(principal: float, annual_rate: float, term_months: int) -> float:
        r = annual_rate / 12
        return round(principal * (r * (1 + r) ** term_months) / ((1 + r) ** term_months - 1), 2)

    mortgage1 = Mortgage(
        property_id=prop1.id,
        principal=200000.0,
        interest_rate=0.065,
        term_months=360,
        lender="First National Bank",
        monthly_pi=calc_monthly_pi(200000.0, 0.065, 360),
        monthly_escrow=210.0,   # est. taxes + insurance
        origination_date=datetime.date(2020, 5, 15),
    )

    mortgage2 = Mortgage(
        property_id=prop2.id,
        principal=400000.0,
        interest_rate=0.070,
        term_months=360,
        lender="Metro Credit Union",
        monthly_pi=calc_monthly_pi(400000.0, 0.070, 360),
        monthly_escrow=420.0,
        origination_date=datetime.date(2021, 8, 10),
    )

    db.add(mortgage1)
    db.add(mortgage2)
    db.commit()

    # ------------------------------------------------------------------ #
    # Tenants
    # ------------------------------------------------------------------ #
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
        lease_end=datetime.date(2026, 7, 15),   # expires in ~28 days from 2026-06-17 → triggers F2
        rent_amount=1200.0,
        intent="Moving Out / Notice Given"
    )

    db.add(tenant1)
    db.add(tenant2)
    db.commit()

    # ------------------------------------------------------------------ #
    # Transactions  (current year so cashflow report shows data)
    # ------------------------------------------------------------------ #
    txns = [
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 1, 1),
            amount=1500.0, category="Rent", type="income",
            description="January Rent", status="Paid"
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 2, 1),
            amount=1500.0, category="Rent", type="income",
            description="February Rent", status="Paid"
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 3, 1),
            amount=1500.0, category="Rent", type="income",
            description="March Rent", status="Paid"
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 4, 1),
            amount=1500.0, category="Rent", type="income",
            description="April Rent", status="Paid"
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 5, 1),
            amount=1500.0, category="Rent", type="income",
            description="May Rent", status="Paid"
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 6, 1),
            amount=1500.0, category="Rent", type="income",
            description="June Rent", status="Paid"
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 6, 15),
            amount=250.0, category="Maintenance", type="expense",
            description="Plumbing repair", status="Paid"
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 1, 15),
            amount=420.0, category="Insurance", type="expense",
            description="Annual insurance premium (monthly portion)", status="Paid"
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 2, 1),
            amount=1200.0, category="Rent", type="income",
            description="February Rent - Apt A", status="Unpaid"
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 3, 1),
            amount=1200.0, category="Rent", type="income",
            description="March Rent", status="Paid"
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 4, 1),
            amount=1200.0, category="Rent", type="income",
            description="April Rent", status="Paid"
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 5, 1),
            amount=1200.0, category="Rent", type="income",
            description="May Rent", status="Paid"
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 5, 20),
            amount=800.0, category="Maintenance", type="expense",
            description="HVAC service", status="Paid"
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 2, 15),
            amount=350.0, category="Maintenance", type="expense",
            description="Roof inspection", status="Paid"
        ),
    ]

    for t in txns:
        db.add(t)
    db.commit()

    print("Database seeded successfully.")
    db.close()


if __name__ == "__main__":
    seed_db()
