from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base


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
    category = Column(String) # e.g., Rent, Maintenance, Mortgage, Taxes
    type = Column(String) # "income" or "expense"
    description = Column(String)
    status = Column(String, default="Paid")

    property = relationship("Property", back_populates="transactions")
