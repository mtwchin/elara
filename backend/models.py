from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, BigInteger
from sqlalchemy.orm import relationship
from database import Base
import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    address = Column(String, index=True)
    property_type = Column(String)  # e.g., Single Family, Multi Family, Commercial
    purchase_price = Column(Float)
    purchase_date = Column(Date)
    status = Column(String, default="Active")

    tenants = relationship("Tenant", back_populates="property")
    transactions = relationship("Transaction", back_populates="property")
    mortgage = relationship("Mortgage", back_populates="property", uselist=False)
    documents = relationship("Document", back_populates="property")


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String)
    phone = Column(String)
    property_id = Column(Integer, ForeignKey("properties.id"))
    lease_start = Column(Date)
    lease_end = Column(Date)
    rent_amount = Column(Float)
    intent = Column(String, default="Undecided")

    property = relationship("Property", back_populates="tenants")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"))
    transaction_date = Column(Date)
    amount = Column(Float)
    category = Column(String)  # e.g., Rent, Maintenance, Mortgage, Taxes
    type = Column(String)  # "income" or "expense"
    description = Column(String)
    status = Column(String, default="Paid")

    property = relationship("Property", back_populates="transactions")
    documents = relationship("Document", back_populates="transaction")


class Mortgage(Base):
    """One mortgage per property (v1). Tracks the financing details needed for
    cash-on-cash return and real debt-service calculations."""
    __tablename__ = "mortgages"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), unique=True, nullable=False, index=True)
    principal = Column(Float, nullable=False)          # original loan balance
    interest_rate = Column(Float, nullable=False)      # annual rate as decimal e.g. 0.065
    term_months = Column(Integer, nullable=False)      # e.g. 360 for 30-year
    lender = Column(String)
    monthly_pi = Column(Float, nullable=False)         # principal + interest payment
    monthly_escrow = Column(Float, default=0.0)        # taxes + insurance escrow
    origination_date = Column(Date)

    property = relationship("Property", back_populates="mortgage")


class Document(Base):
    """Attachment for a transaction or a property. At least one FK must be set."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True, index=True)
    filename = Column(String, nullable=False)          # original filename from upload
    storage_path = Column(String, nullable=False)      # path under backend/uploads/
    mime_type = Column(String)
    size_bytes = Column(BigInteger, default=0)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    transaction = relationship("Transaction", back_populates="documents")
    property = relationship("Property", back_populates="documents")
