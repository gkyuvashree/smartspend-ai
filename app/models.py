from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    receipts = relationship("Receipt", back_populates="owner", cascade="all, delete-orphan")
    anomalies = relationship("Anomaly", back_populates="owner", cascade="all, delete-orphan")

class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    store_name = Column(String, index=True)
    total_amount = Column(Float, nullable=False)
    tax_amount = Column(Float, default=0.0)
    date = Column(String, index=True)  # YYYY-MM-DD
    image_path = Column(String, nullable=True)
    duplicate_hash = Column(String, index=True, nullable=True)  # MD5 of the receipt image
    ocr_avg_confidence = Column(Float, default=0.0)
    raw_text = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="receipts")
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")

class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, default=1)
    category = Column(String, index=True, default="Others")  # Groceries, Dining, Snacks, Travel, Personal Care, Beverages, Others
    ocr_confidence = Column(Float, default=100.0)

    # Relationships
    receipt = relationship("Receipt", back_populates="items")

class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, index=True)  # unusual_spike, recurring_pattern, subscription
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    severity = Column(String, default="info")  # info, warning, high
    detected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="anomalies")
