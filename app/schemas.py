from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

# --- Authentication Schemas ---
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Receipt Item Schemas ---
class ReceiptItemBase(BaseModel):
    name: str
    price: float
    quantity: int = 1
    category: str
    ocr_confidence: float = 100.0

class ReceiptItemCreate(ReceiptItemBase):
    pass

class ReceiptItemResponse(ReceiptItemBase):
    id: int
    receipt_id: int

    class Config:
        from_attributes = True

# --- Receipt Schemas ---
class ReceiptBase(BaseModel):
    store_name: Optional[str] = None
    total_amount: float
    tax_amount: float = 0.0
    date: str  # YYYY-MM-DD
    raw_text: Optional[str] = None

class ReceiptCreate(ReceiptBase):
    image_path: Optional[str] = None
    duplicate_hash: Optional[str] = None
    ocr_avg_confidence: float = 0.0

class ReceiptResponse(ReceiptBase):
    id: int
    user_id: int
    image_path: Optional[str] = None
    ocr_avg_confidence: float
    created_at: datetime

    class Config:
        from_attributes = True

class ReceiptDetailResponse(ReceiptResponse):
    items: List[ReceiptItemResponse] = []

    class Config:
        from_attributes = True

class ReceiptItemUpdate(BaseModel):
    id: Optional[int] = None
    name: str
    price: float
    quantity: int = 1
    category: str
    ocr_confidence: float = 100.0

class ReceiptUpdate(BaseModel):
    store_name: str
    date: str
    total_amount: float
    tax_amount: float = 0.0
    items: List[ReceiptItemUpdate]


# --- Anomaly/Trend Schemas ---
class AnomalyResponse(BaseModel):
    id: int
    type: str
    title: str
    description: str
    severity: str
    detected_at: datetime

    class Config:
        from_attributes = True

# --- Dashboard & Insights Schemas ---
class CategorySpend(BaseModel):
    category: str
    amount: float
    percentage: float
    item_count: int

class MonthlySavingsSuggestion(BaseModel):
    category: str
    title: str
    description: str
    potential_savings: float

class DashboardStats(BaseModel):
    total_spend: float
    receipt_count: int
    health_score: int
    category_breakdown: List[CategorySpend]
    recent_transactions: List[ReceiptDetailResponse]
    insights: List[str]
    anomalies: List[AnomalyResponse]
    savings_suggestions: List[MonthlySavingsSuggestion]
    predictions: dict  # {"next_7_days": float, "next_30_days": float}

# --- Chat Assistant Schemas ---
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str
    suggested_questions: List[str] = []
