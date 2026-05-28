import os
import hashlib
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .database import engine, get_db, Base
from . import models, schemas, auth, ocr, classifier, trends, insights, pdf_export
from .insights import format_inr


# Initialize FastAPI App
app = FastAPI(title="SmartSpend AI API", version="1.0.0")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure Database Tables exist
Base.metadata.create_all(bind=engine)

# Ensure Uploads directory exists
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static uploads directory to serve receipt images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- AUTH ENDPOINTS ---

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if username or email exists
    db_user = db.query(models.User).filter(
        (models.User.username == user.username) | (models.User.email == user.email)
    ).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
        
    hashed_pwd = auth.get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = auth.create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# --- RECEIPT SCANNING & MANAGEMENT ENDPOINTS ---

@app.post("/api/receipts/upload", response_model=schemas.ReceiptDetailResponse)
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Receives an uploaded receipt image:
    1. Computes MD5 hash to perform Duplicate Receipt Detection.
    2. Saves the image.
    3. Runs OpenCV-filtered Tesseract OCR to parse store name, date, items, prices, and totals.
    4. Automatically classifies items via local Jaccard Similarity NLP.
    5. Commits data to SQLite and updates spending trend anomalies.
    """
    # 1. Read file bytes and compute MD5
    file_bytes = await file.read()
    md5_hash = hashlib.md5(file_bytes).hexdigest()
    
    # Check for Duplicate receipt for this specific user
    existing_duplicate = db.query(models.Receipt).filter(
        models.Receipt.user_id == current_user.id,
        models.Receipt.duplicate_hash == md5_hash
    ).first()
    if existing_duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duplicate Receipt Detected! This exact receipt image was already scanned on {existing_duplicate.created_at.strftime('%Y-%m-%d')}."
        )
        
    # 2. Save Image File
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".jpg", ".jpeg", ".png"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a JPG or PNG receipt image."
        )
        
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    saved_file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(saved_file_path, "wb") as buffer:
        buffer.write(file_bytes)
        
    # 3. Process image and run OCR
    try:
        raw_text, words_list, ocr_confidence, engine_used = ocr.extract_ocr_data(saved_file_path)
        parsed_data = ocr.parse_receipt(raw_text, words_list)
    except Exception as e:
        # Cleanup file if OCR crashes
        if os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR Engine failed: {str(e)}"
        )
        
    # 4. Save parsed receipt
    new_receipt = models.Receipt(
        user_id=current_user.id,
        store_name=parsed_data["store_name"],
        total_amount=parsed_data["total_amount"],
        tax_amount=parsed_data["tax_amount"],
        date=parsed_data["date"],
        image_path=saved_file_path,
        duplicate_hash=md5_hash,
        ocr_avg_confidence=round(ocr_confidence, 1),
        raw_text=raw_text
    )
    db.add(new_receipt)
    db.commit()
    db.refresh(new_receipt)
    
    # 5. Classify and save items
    for item in parsed_data["items"]:
        item_cat = classifier.classify_item(item["name"])
        new_item = models.ReceiptItem(
            receipt_id=new_receipt.id,
            name=item["name"],
            price=item["price"],
            quantity=item["quantity"],
            category=item_cat,
            ocr_confidence=round(item["ocr_confidence"], 1)
        )
        db.add(new_item)
        
    db.commit()
    db.refresh(new_receipt)
    
    # 6. Run anomaly and spending trend updates
    trends.detect_all_trends_and_anomalies(db, current_user.id)
    
    return new_receipt

@app.get("/api/receipts/history", response_model=List[schemas.ReceiptDetailResponse])
def get_receipt_history(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search and filter user receipt timeline history.
    """
    query = db.query(models.Receipt).filter(models.Receipt.user_id == current_user.id)
    
    if start_date:
        query = query.filter(models.Receipt.date >= start_date)
    if end_date:
        query = query.filter(models.Receipt.date <= end_date)
        
    if category:
        query = query.join(models.ReceiptItem).filter(models.ReceiptItem.category == category).distinct()
        
    if search:
        search_filter = f"%{search}%"
        # Match store name OR line item names
        query = query.outerjoin(models.ReceiptItem).filter(
            (models.Receipt.store_name.like(search_filter)) | 
            (models.ReceiptItem.name.like(search_filter))
        ).distinct()
        
    return query.order_by(models.Receipt.date.desc()).all()

@app.put("/api/receipts/{receipt_id}", response_model=schemas.ReceiptDetailResponse)
def update_receipt(
    receipt_id: int,
    payload: schemas.ReceiptUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == current_user.id
    ).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
        
    # Update receipt headers
    receipt.store_name = payload.store_name
    receipt.date = payload.date
    receipt.total_amount = payload.total_amount
    receipt.tax_amount = payload.tax_amount
    
    # Delete old items and insert updated ones
    db.query(models.ReceiptItem).filter(models.ReceiptItem.receipt_id == receipt.id).delete()
    for item in payload.items:
        new_item = models.ReceiptItem(
            receipt_id=receipt.id,
            name=item.name,
            price=item.price,
            quantity=item.quantity,
            category=item.category,
            ocr_confidence=item.ocr_confidence
        )
        db.add(new_item)
        
    db.commit()
    db.refresh(receipt)
    
    # Run anomaly detector
    trends.detect_all_trends_and_anomalies(db, current_user.id)
    return receipt

@app.delete("/api/receipts/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_receipt(
    receipt_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == current_user.id
    ).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
        
    # Delete local image file
    if receipt.image_path and os.path.exists(receipt.image_path):
        try:
            os.remove(receipt.image_path)
        except Exception:
            pass
            
    db.delete(receipt)
    db.commit()
    
    # Update anomalies after deletion
    trends.detect_all_trends_and_anomalies(db, current_user.id)
    return

# --- DASHBOARD & ANALYTICS ENDPOINTS ---

@app.get("/api/dashboard", response_model=schemas.DashboardStats)
def get_dashboard_summary(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Aggregates financial dashboard metrics, category spends, AI insights, linear regressions, and anomalies.
    """
    stats = insights.calculate_insights_and_predictions(db, current_user.id)
    
    # Get recent transactions
    recent_receipts = db.query(models.Receipt).filter(
        models.Receipt.user_id == current_user.id
    ).order_by(models.Receipt.date.desc()).limit(5).all()
    
    # Get anomalies
    anomalies = db.query(models.Anomaly).filter(
        models.Anomaly.user_id == current_user.id
    ).order_by(models.Anomaly.detected_at.desc()).all()
    
    return {
        **stats,
        "recent_transactions": recent_receipts,
        "anomalies": anomalies
    }

# --- PDF REPORT EXPORT ENDPOINT ---

@app.get("/api/reports/export")
def export_dashboard_pdf(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Serves a beautifully generated executive PDF report of the user's spending habits.
    """
    pdf_buffer = pdf_export.generate_financial_report_pdf(db, current_user)
    
    filename = f"SmartSpend_Report_{current_user.username}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- OFFLINE AI ASSISTANT CHATBOT ENDPOINT ---

@app.post("/api/chat", response_model=schemas.ChatResponse)
def run_financial_chat_assistant(
    payload: schemas.ChatRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Offline local NLP Chatbot.
    Queries the database dynamically to answer queries about category totals, budget shares,
    active subscriptions, anomalies, and general financial health.
    """
    prompt = payload.message.lower().strip()
    stats = insights.calculate_insights_and_predictions(db, current_user.id)
    
    reply = ""
    suggested = [
        "What is my Financial Health Score?",
        "Do I have active subscriptions?",
        "Any advice to save money?",
        "Where did my money go?"
    ]
    
    # Identify query focus
    if "health" in prompt or "score" in prompt:
        score = stats["health_score"]
        rating = "Excellent" if score >= 85 else ("Good" if score >= 70 else "Needs Work")
        reply = (
            f"Your **Financial Health Score is {score}/100** ({rating}). "
            f"This is calculated based on your essential vs. discretionary spending balance and recent budget trajectories. "
        )
        if score < 80:
            reply += "To increase your score, try limiting purchases in high discretionary categories like Snacks and Beverages."
        else:
            reply += "Outstanding job! Keep up the highly disciplined spending pattern."
            
    elif "subscription" in prompt or "recurring" in prompt:
        anomalies = db.query(models.Anomaly).filter(
            models.Anomaly.user_id == current_user.id,
            models.Anomaly.type == "subscription"
        ).all()
        if anomalies:
            reply = "We detected the following **monthly subscriptions** in your receipts history:\n\n"
            for a in anomalies:
                reply += f"• **{a.title}**: {a.description}\n"
        else:
            reply = "We analyzed your receipt histories and **did not detect any monthly subscriptions**. All transactions appear to be one-off purchases."
            
    elif "groceries" in prompt or "grocery" in prompt:
        cat_data = next((c for c in stats["category_breakdown"] if c["category"] == "Groceries"), None)
        if cat_data:
            reply = f"You spent a total of **{format_inr(cat_data['amount'])}** on **Groceries** across **{cat_data['item_count']} items**. This represents **{cat_data['percentage']}%** of your total budget."
        else:
            reply = "You haven't spent anything categorized under **Groceries** yet."
            
    elif "dining" in prompt or "restaurant" in prompt:
        cat_data = next((c for c in stats["category_breakdown"] if c["category"] == "Dining"), None)
        if cat_data:
            reply = f"You spent a total of **{format_inr(cat_data['amount'])}** on **Dining Out** across **{cat_data['item_count']} transactions**. This accounts for **{cat_data['percentage']}%** of your total spending. Cooking more at home is a high-yield savings path!"
        else:
            reply = "You haven't spent anything categorized under **Dining** yet."
            
    elif "snacks" in prompt or "snack" in prompt:
        cat_data = next((c for c in stats["category_breakdown"] if c["category"] == "Snacks"), None)
        if cat_data:
            reply = f"You spent a total of **{format_inr(cat_data['amount'])}** on **Snacks** across **{cat_data['item_count']} items** (**{cat_data['percentage']}%** of your budget). Try buying in bulk to optimize these costs!"
        else:
            reply = "You haven't spent anything categorized under **Snacks** yet."

    elif "beverages" in prompt or "beverage" in prompt or "drink" in prompt:
        cat_data = next((c for c in stats["category_breakdown"] if c["category"] == "Beverages"), None)
        if cat_data:
            reply = f"You spent a total of **{format_inr(cat_data['amount'])}** on **Beverages** (**{cat_data['percentage']}%** of your budget). Limiting premium craft drinks, soft drinks, or high-end coffee cups is a smart move."
        else:
            reply = "You haven't spent anything categorized under **Beverages** yet."
            
    elif "save" in prompt or "advice" in prompt or "suggestion" in prompt:
        if stats["savings_suggestions"]:
            reply = "Here are **AI Savings Recommendations** specifically tailored to your patterns:\n\n"
            for s in stats["savings_suggestions"]:
                reply += f"• **{s['title']}**: {s['description']} (Potential monthly savings: **{format_inr(s['potential_savings'])}**)\n"
        else:
            reply = "Awesome! We don't have any specific savings deductions right now because your discretionary categories are well within limits. Keep it up!"
            
    elif "where" in prompt or "money" in prompt or "spending" in prompt or "summary" in prompt:
        reply = (
            f"You have scanned **{stats['receipt_count']} receipts** with a **total spend of {format_inr(stats['total_spend'])}**. "
            f"Your highest spending category is **{stats['category_breakdown'][0]['category'] if stats['category_breakdown'] else 'N/A'}** "
            f"at **{format_inr(stats['category_breakdown'][0]['amount']) if stats['category_breakdown'] else 'N/A'}**.\n\n"
            f"Our trend models project that you will spend **{format_inr(stats['predictions']['next_7_days'])}** in the next 7 days."
        )
        
    else:
        reply = (
            f"Hello! I am your **SmartSpend AI assistant**. I parse your financial history locally. "
            f"I see you have a total spending of **{format_inr(stats['total_spend'])}** across **{stats['receipt_count']} receipts**, "
            f"yielding a Financial Health Score of **{stats['health_score']}/100**.\n\n"
            f"Ask me about specific categories ('Groceries', 'Dining', 'Snacks'), subscriptions ('Do I have subscriptions?'), "
            f"or ask 'Where did my money go?' to get a summary!"
        )

    return {
        "reply": reply,
        "suggested_questions": suggested
    }
