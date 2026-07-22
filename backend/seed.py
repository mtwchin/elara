import datetime
import os
from database import SessionLocal, engine, Base
from models import Organization, Property, Tenant, Transaction, User, UserRole, Mortgage
from auth import hash_password

Base.metadata.create_all(bind=engine)

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "Demo123456!"


def seed_db():
    db = SessionLocal()

    demo_org = None
    if os.environ.get("SEED_DEMO_USER", "true").lower() == "true":
        demo_user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if not demo_user:
            demo_user = User(email=DEMO_EMAIL, hashed_password=hash_password(DEMO_PASSWORD))
            db.add(demo_user)
            db.flush()
            print(f"Seeded demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")

        role = db.query(UserRole).filter(UserRole.user_id == demo_user.id).first()
        if role:
            demo_org = db.query(Organization).filter(Organization.id == role.organization_id).first()
        if not demo_org:
            demo_org = Organization(name="Demo Portfolio")
            db.add(demo_org)
            db.flush()
            db.add(UserRole(user_id=demo_user.id, organization_id=demo_org.id, role="Owner"))
        db.commit()

    if db.query(Property).first():
        print("Database already seeded.")
        db.close()
        return

    organization_id = demo_org.id if demo_org else None

    # ------------------------------------------------------------------ #
    # Properties
    # ------------------------------------------------------------------ #
    prop1 = Property(
        address="123 Maple Ave, Austin, TX",
        property_type="Single Family",
        purchase_price=380000.0,
        purchase_date=datetime.date(2021, 3, 15),
        status="Active",
        organization_id=organization_id,
    )
    prop2 = Property(
        address="456 Oak Street, Austin, TX",
        property_type="Multi Family",
        purchase_price=620000.0,
        purchase_date=datetime.date(2020, 9, 1),
        status="Active",
        organization_id=organization_id,
    )
    prop3 = Property(
        address="789 Cedar Lane, Austin, TX",
        property_type="Single Family",
        purchase_price=295000.0,
        purchase_date=datetime.date(2023, 6, 20),
        status="Vacant",
        organization_id=organization_id,
    )

    db.add_all([prop1, prop2, prop3])
    db.commit()
    db.refresh(prop1)
    db.refresh(prop2)
    db.refresh(prop3)

    # ------------------------------------------------------------------ #
    # Mortgages
    # ------------------------------------------------------------------ #
    def calc_monthly_pi(principal: float, annual_rate_pct: float, term_months: int) -> float:
        # annual_rate_pct is a percentage e.g. 6.25 for 6.25%
        r = (annual_rate_pct / 100) / 12
        return round(principal * (r * (1 + r) ** term_months) / ((1 + r) ** term_months - 1), 2)

    db.add_all([
        Mortgage(
            property_id=prop1.id,
            principal=304000.0,
            interest_rate=6.25,
            term_months=360,
            lender="Lone Star Mortgage",
            monthly_pi=calc_monthly_pi(304000.0, 6.25, 360),
            monthly_escrow=340.0,
            origination_date=datetime.date(2021, 3, 15),
        ),
        Mortgage(
            property_id=prop2.id,
            principal=496000.0,
            interest_rate=6.75,
            term_months=360,
            lender="Texas Capital Bank",
            monthly_pi=calc_monthly_pi(496000.0, 6.75, 360),
            monthly_escrow=580.0,
            origination_date=datetime.date(2020, 9, 1),
        ),
        Mortgage(
            property_id=prop3.id,
            principal=236000.0,
            interest_rate=7.25,
            term_months=360,
            lender="First National Bank",
            monthly_pi=calc_monthly_pi(236000.0, 7.25, 360),
            monthly_escrow=280.0,
            origination_date=datetime.date(2023, 6, 20),
        ),
    ])
    db.commit()

    # ------------------------------------------------------------------ #
    # Tenants
    # ------------------------------------------------------------------ #
    # tenant3 lease expires in ~28 days → triggers lease-expiration alert
    # tenant4 is at the vacant prop3 → no active lease (prop stays vacant)
    db.add_all([
        Tenant(
            name="Marcus Chen",
            email="marcus.chen@email.com",
            phone="512-555-0101",
            property_id=prop1.id,
            organization_id=organization_id,
            lease_start=datetime.date(2025, 8, 1),
            lease_end=datetime.date(2026, 7, 31),
            rent_amount=2400.0,
            intent="Renewing",
        ),
        Tenant(
            name="Sarah Johnson",
            email="sarah.j@email.com",
            phone="512-555-0102",
            property_id=prop2.id,
            organization_id=organization_id,
            lease_start=datetime.date(2025, 10, 1),
            lease_end=datetime.date(2026, 9, 30),
            rent_amount=3200.0,
            intent="Undecided",
        ),
        Tenant(
            name="Devon Williams",
            email="devon.w@email.com",
            phone="512-555-0103",
            property_id=prop2.id,
            organization_id=organization_id,
            lease_start=datetime.date(2025, 6, 1),
            lease_end=datetime.date(2026, 7, 15),   # ~28 days left → renewal alert
            rent_amount=1800.0,
            intent="Moving Out / Notice Given",
        ),
    ])
    db.commit()

    # ------------------------------------------------------------------ #
    # Transactions — 12 months back from 2026-06-17 for rich reports
    # ------------------------------------------------------------------ #
    txns = []

    # Prop1: $2,400/mo rent from Jul 2025 → Jun 2026
    for month_offset in range(12):
        d = datetime.date(2025, 7, 1) + datetime.timedelta(days=31 * month_offset)
        d = d.replace(day=1)
        txns.append(Transaction(
            property_id=prop1.id,
            transaction_date=d,
            amount=2400.0, category="Rent", type="income",
            description=f"Rent - {d.strftime('%B %Y')}", status="Paid",
        ))

    # Prop1: recurring expenses
    for month_offset in range(12):
        d = datetime.date(2025, 7, 1) + datetime.timedelta(days=31 * month_offset)
        d = d.replace(day=15)
        txns.append(Transaction(
            property_id=prop1.id,
            transaction_date=d,
            amount=155.0, category="Utilities", type="expense",
            description="Water & trash", status="Paid",
        ))
    # Insurance (quarterly)
    for month in [7, 10, 1, 4]:
        year = 2025 if month >= 7 else 2026
        txns.append(Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(year, month, 1),
            amount=480.0, category="Insurance", type="expense",
            description="Property insurance (quarterly)", status="Paid",
        ))
    # Maintenance events
    txns += [
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2025, 8, 10),
            amount=320.0, category="Maintenance", type="expense",
            description="HVAC filter + tune-up", status="Paid",
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2025, 11, 5),
            amount=175.0, category="Maintenance", type="expense",
            description="Gutter cleaning", status="Paid",
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 3, 22),
            amount=890.0, category="Maintenance", type="expense",
            description="Water heater replacement", status="Paid",
        ),
        Transaction(
            property_id=prop1.id,
            transaction_date=datetime.date(2026, 6, 10),
            amount=240.0, category="Maintenance", type="expense",
            description="Lawn care + sprinkler repair", status="Paid",
        ),
    ]
    # Property tax (annual)
    txns.append(Transaction(
        property_id=prop1.id,
        transaction_date=datetime.date(2025, 12, 1),
        amount=4750.0, category="Taxes", type="expense",
        description="Annual property tax 2025", status="Paid",
    ))

    # Prop2: $3,200 + $1,800 = $5,000/mo combined rent from Jul 2025
    for month_offset in range(12):
        d = datetime.date(2025, 7, 1) + datetime.timedelta(days=31 * month_offset)
        d = d.replace(day=1)
        txns.append(Transaction(
            property_id=prop2.id,
            transaction_date=d,
            amount=5000.0, category="Rent", type="income",
            description=f"Combined rent - {d.strftime('%B %Y')}", status="Paid",
        ))
    # Prop2: expenses
    for month_offset in range(12):
        d = datetime.date(2025, 7, 1) + datetime.timedelta(days=31 * month_offset)
        d = d.replace(day=15)
        txns.append(Transaction(
            property_id=prop2.id,
            transaction_date=d,
            amount=220.0, category="Utilities", type="expense",
            description="Common area utilities", status="Paid",
        ))
    txns += [
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2025, 9, 15),
            amount=1200.0, category="Maintenance", type="expense",
            description="Roof repair — Unit A", status="Paid",
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 1, 8),
            amount=650.0, category="Maintenance", type="expense",
            description="Plumbing — Unit B", status="Paid",
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 4, 20),
            amount=420.0, category="Management", type="expense",
            description="Property management fee", status="Paid",
        ),
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2025, 12, 1),
            amount=7800.0, category="Taxes", type="expense",
            description="Annual property tax 2025", status="Paid",
        ),
        # Unpaid June rent for DevOn Williams (leaving)
        Transaction(
            property_id=prop2.id,
            transaction_date=datetime.date(2026, 6, 1),
            amount=1800.0, category="Rent", type="income",
            description="June Rent - Devon Williams", status="Unpaid",
        ),
    ]

    # Prop3: vacant — only mortgage-related expense, no income
    txns.append(Transaction(
        property_id=prop3.id,
        transaction_date=datetime.date(2026, 5, 1),
        amount=310.0, category="Maintenance", type="expense",
        description="Turnover cleaning + paint touch-up", status="Paid",
    ))

    for t in txns:
        t.organization_id = organization_id
        db.add(t)
    db.commit()

    print("Database seeded successfully.")
    print(f"  Properties: {db.query(Property).count()}")
    print(f"  Tenants:    {db.query(Tenant).count()}")
    print(f"  Transactions: {db.query(Transaction).count()}")
    db.close()


if __name__ == "__main__":
    seed_db()
