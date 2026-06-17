import re

with open("main.py", "r") as f:
    content = f.read()

# Make sure Transaction and pydantic BaseModels are imported
if "from models import Property, Tenant" in content:
    content = content.replace(
        "from models import Property, Tenant",
        "from models import Property, Tenant, Transaction\nfrom pydantic import BaseModel\nfrom typing import Optional"
    )

new_endpoints = """
class TransactionCreate(BaseModel):
    property_id: int
    transaction_date: datetime.date
    amount: float
    category: str
    type: str
    description: Optional[str] = None
    status: Optional[str] = "Paid"

@app.get("/api/transactions")
async def get_transactions(db: Session = Depends(get_db)):
    transactions = db.query(Transaction).all()
    # Need to return related property data. FastAPI handles this if we return relationships but let's build it manually if needed, or rely on dict.
    results = []
    for t in transactions:
        p = db.query(Property).filter(Property.id == t.property_id).first()
        t_dict = {
            "id": t.id,
            "property_id": t.property_id,
            "transaction_date": t.transaction_date,
            "amount": t.amount,
            "category": t.category,
            "type": t.type,
            "description": t.description,
            "status": t.status,
            "property": p
        }
        results.append(t_dict)
    return results

@app.post("/api/transactions")
async def create_transaction(tx: TransactionCreate, db: Session = Depends(get_db)):
    new_tx = Transaction(
        property_id=tx.property_id,
        transaction_date=tx.transaction_date,
        amount=tx.amount,
        category=tx.category,
        type=tx.type,
        description=tx.description,
        status=tx.status
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    return new_tx

@app.get("/api/reports/cashflow")
async def get_cashflow_report(db: Session = Depends(get_db)):
    today = datetime.date.today()
    current_year = today.year
    current_month = today.month

    transactions = db.query(Transaction).all()
    properties = db.query(Property).all()

    report = {
        "portfolio": {
            "monthly": {"income": 0, "expense": 0, "cash_flow": 0},
            "ytd": {"income": 0, "expense": 0, "cash_flow": 0}
        },
        "properties": []
    }

    prop_stats = {}
    for p in properties:
        prop_stats[p.id] = {
            "property_id": p.id,
            "address": p.address,
            "monthly": {"income": 0, "expense": 0, "cash_flow": 0},
            "ytd": {"income": 0, "expense": 0, "cash_flow": 0}
        }

    for t in transactions:
        # Ignore unpaid? The prompt doesn't specify if unpaid rent should be excluded, but usually cashflow only counts actual cash. Let's assume we include only "Paid" transactions for cashflow.
        if t.status != "Paid":
            continue
            
        t_year = t.transaction_date.year
        t_month = t.transaction_date.month
        
        if t_year == current_year:
            # Add to YTD
            if t.type == "income":
                report["portfolio"]["ytd"]["income"] += t.amount
                if t.property_id in prop_stats:
                    prop_stats[t.property_id]["ytd"]["income"] += t.amount
            else:
                report["portfolio"]["ytd"]["expense"] += t.amount
                if t.property_id in prop_stats:
                    prop_stats[t.property_id]["ytd"]["expense"] += t.amount
            
            # Add to Monthly
            if t_month == current_month:
                if t.type == "income":
                    report["portfolio"]["monthly"]["income"] += t.amount
                    if t.property_id in prop_stats:
                        prop_stats[t.property_id]["monthly"]["income"] += t.amount
                else:
                    report["portfolio"]["monthly"]["expense"] += t.amount
                    if t.property_id in prop_stats:
                        prop_stats[t.property_id]["monthly"]["expense"] += t.amount

    # Calculate Cash flow
    report["portfolio"]["monthly"]["cash_flow"] = report["portfolio"]["monthly"]["income"] - report["portfolio"]["monthly"]["expense"]
    report["portfolio"]["ytd"]["cash_flow"] = report["portfolio"]["ytd"]["income"] - report["portfolio"]["ytd"]["expense"]

    for pid, stats in prop_stats.items():
        stats["monthly"]["cash_flow"] = stats["monthly"]["income"] - stats["monthly"]["expense"]
        stats["ytd"]["cash_flow"] = stats["ytd"]["income"] - stats["ytd"]["expense"]
        report["properties"].append(stats)

    return report
"""

content = content + "\n" + new_endpoints

with open("main.py", "w") as f:
    f.write(content)

print("Patched main.py")
