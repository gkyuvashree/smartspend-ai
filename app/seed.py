import os
import sys
import hashlib
from datetime import datetime, timedelta
import random

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app import models, auth, trends

def seed_database():
    """
    Seeds the SQLite database with 6 months of realistic multi-category consumer spending
    for a default demo user (username: demo_user, password: password123).
    Automatically runs the trend detection pipeline to generate rich analytics,
    subscriptions, and spending anomalies.
    """
    print("Initializing Database Seeder...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # 1. Create Demo User if not exists
        demo_username = "demo_user"
        demo_email = "demo@smartspend.ai"
        
        user = db.query(models.User).filter(models.User.username == demo_username).first()
        if not user:
            print("Creating Demo User...")
            hashed_pwd = auth.get_password_hash("password123")
            user = models.User(
                username=demo_username,
                email=demo_email,
                hashed_password=hashed_pwd
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Demo User created successfully!")
        else:
            print("Demo User already exists.")
            
        # Clear existing receipts for the demo user to rebuild clean presentation state
        db.query(models.Receipt).filter(models.Receipt.user_id == user.id).delete()
        db.commit()
        print("Cleared old mock receipt data.")

        # 2. Build 6 months of spending history
        now = datetime.utcnow()
        start_date = now - timedelta(days=180)
        
        merchants = {
            "Reliance Smart": {
                "items": [
                    ("Organic Milk", 80.00, "Groceries"),
                    ("Eggs 12pk", 90.00, "Groceries"),
                    ("Wheat Bread", 50.00, "Groceries"),
                    ("Fresh Spinach", 40.00, "Groceries"),
                    ("Bananas Bunch", 60.00, "Groceries"),
                    ("Chicken Breasts", 320.00, "Groceries")
                ]
            },
            "Starbucks": {
                "items": [
                    ("Caffe Latte", 280.00, "Beverages"),
                    ("Croissant", 180.00, "Snacks"),
                    ("Green Tea", 220.00, "Beverages"),
                    ("Mocha Frappuccino", 320.00, "Beverages")
                ]
            },
            "McDonald's": {
                "items": [
                    ("McSpicy Chicken Meal", 350.00, "Dining"),
                    ("Fries Large", 120.00, "Snacks"),
                    ("Pizza Pocket", 60.00, "Snacks"),
                    ("Diet Coke", 90.00, "Beverages")
                ]
            },
            "Indian Oil": {
                "items": [
                    ("Regular Gasoline", 2500.00, "Travel"),
                    ("Car Wash", 250.00, "Travel"),
                    ("Energy Bar", 80.00, "Snacks"),
                    ("Gatorade", 90.00, "Beverages")
                ]
            },
            "Apollo Pharmacy": {
                "items": [
                    ("Shampoo", 240.00, "Personal Care"),
                    ("Dental Floss", 90.00, "Personal Care"),
                    ("Vitamin C 100ct", 380.00, "Personal Care"),
                    ("Ibuprofen", 40.00, "Personal Care"),
                    ("Deodorant", 180.00, "Personal Care")
                ]
            },
            "Punjab Grill": {
                "items": [
                    ("Chicken Butter Masala", 480.00, "Dining"),
                    ("Dal Makhani", 380.00, "Dining"),
                    ("Garlic Naan", 80.00, "Dining"),
                    ("Lassi Premium", 120.00, "Beverages")
                ]
            },
            "Uber": {
                "items": [
                    ("Rideshare Trip", 350.00, "Travel"),
                    ("Rideshare Surge", 580.00, "Travel")
                ]
            }
        }
        
        created_count = 0
        current_date = start_date
        
        print("Generating 6 months of historical transactions...")
        
        while current_date <= now:
            # 1. Groceries/CVS: Weekly on Sundays/Saturdays
            if current_date.weekday() in [5, 6]:
                # 80% chance of a weekly shop
                if random.random() < 0.8:
                    merchant = "Reliance Smart" if random.random() < 0.8 else "Apollo Pharmacy"
                    items_pool = merchants[merchant]["items"]
                    
                    # Choose 3-6 random items
                    chosen_items = random.sample(items_pool, k=random.randint(3, len(items_pool)))
                    
                    # Compute total with random quantities
                    item_details = []
                    subtotal = 0.0
                    for name, unit_price, cat in chosen_items:
                        qty = random.randint(1, 3)
                        total_item_price = round(unit_price * qty, 2)
                        subtotal += total_item_price
                        item_details.append((name, unit_price, qty, total_item_price, cat))
                        
                    tax = round(subtotal * 0.08, 2)
                    total_amount = round(subtotal + tax, 2)
                    
                    dummy_bytes = f"{merchant}_{current_date.strftime('%Y-%m-%d')}_{total_amount}".encode('utf-8')
                    m_hash = hashlib.md5(dummy_bytes).hexdigest()
                    
                    # Create mock raw text
                    raw_lines = [f"WELCOME TO {merchant.upper()}", f"DATE: {current_date.strftime('%Y-%m-%d')}", "-------------------------"]
                    for name, uprice, qty, tprice, _ in item_details:
                        raw_lines.append(f"{qty} {name:<18} @ {uprice:.2f}    {tprice:.2f}")
                    raw_lines.extend(["-------------------------", f"SUBTOTAL:          {subtotal:.2f}", f"TAX (8%):           {tax:.2f}", f"TOTAL:             {total_amount:.2f}"])
                    raw_text_content = "\n".join(raw_lines)

                    receipt = models.Receipt(
                        user_id=user.id,
                        store_name=merchant,
                        total_amount=total_amount,
                        tax_amount=tax,
                        date=current_date.strftime("%Y-%m-%d"),
                        duplicate_hash=m_hash,
                        ocr_avg_confidence=round(random.uniform(92.0, 99.0), 1),
                        raw_text=raw_text_content
                    )
                    db.add(receipt)
                    db.commit()
                    
                    for name, unit_price, qty, tprice, cat in item_details:
                        db.add(models.ReceiptItem(
                            receipt_id=receipt.id,
                            name=name,
                            price=unit_price,
                            quantity=qty,
                            category=cat,
                            ocr_confidence=round(random.uniform(90.0, 99.0), 1)
                        ))
                    db.commit()
                    created_count += 1

            # 2. Coffee/Snacks (Starbucks): Tuesdays/Thursdays
            if current_date.weekday() in [1, 3]:
                if random.random() < 0.7:
                    merchant = "Starbucks"
                    items_pool = merchants[merchant]["items"]
                    chosen_items = random.sample(items_pool, k=random.randint(1, 2))
                    
                    item_details = []
                    subtotal = 0.0
                    for name, unit_price, cat in chosen_items:
                        qty = random.randint(1, 2)
                        total_item_price = round(unit_price * qty, 2)
                        subtotal += total_item_price
                        item_details.append((name, unit_price, qty, total_item_price, cat))
                        
                    tax = round(subtotal * 0.08, 2)
                    total_amount = round(subtotal + tax, 2)
                    
                    dummy_bytes = f"{merchant}_{current_date.strftime('%Y-%m-%d')}_{total_amount}".encode('utf-8')
                    m_hash = hashlib.md5(dummy_bytes).hexdigest()
                    
                    raw_lines = [f"{merchant.upper()} COFFEE SHOP", f"DATE: {current_date.strftime('%Y-%m-%d')}", "-------------------------"]
                    for name, uprice, qty, tprice, _ in item_details:
                        raw_lines.append(f"{qty} {name:<18} @ {uprice:.2f}    {tprice:.2f}")
                    raw_lines.extend(["-------------------------", f"SUBTOTAL:          {subtotal:.2f}", f"TAX (8%):           {tax:.2f}", f"TOTAL:             {total_amount:.2f}"])
                    raw_text_content = "\n".join(raw_lines)

                    receipt = models.Receipt(
                        user_id=user.id,
                        store_name=merchant,
                        total_amount=total_amount,
                        tax_amount=tax,
                        date=current_date.strftime("%Y-%m-%d"),
                        duplicate_hash=m_hash,
                        ocr_avg_confidence=round(random.uniform(94.0, 99.5), 1),
                        raw_text=raw_text_content
                    )
                    db.add(receipt)
                    db.commit()
                    
                    for name, unit_price, qty, tprice, cat in item_details:
                        db.add(models.ReceiptItem(
                            receipt_id=receipt.id,
                            name=name,
                            price=unit_price,
                            quantity=qty,
                            category=cat,
                            ocr_confidence=round(random.uniform(93.0, 99.5), 1)
                        ))
                    db.commit()
                    created_count += 1

            # 3. Dining Out (McDonald's / Olive Garden): Fridays
            if current_date.weekday() == 4:
                if random.random() < 0.8:
                    merchant = "McDonald's" if random.random() < 0.6 else "Punjab Grill"
                    items_pool = merchants[merchant]["items"]
                    chosen_items = random.sample(items_pool, k=random.randint(2, len(items_pool)))
                    
                    item_details = []
                    subtotal = 0.0
                    for name, unit_price, cat in chosen_items:
                        qty = 1
                        total_item_price = round(unit_price * qty, 2)
                        subtotal += total_item_price
                        item_details.append((name, unit_price, qty, total_item_price, cat))
                        
                    tax = round(subtotal * 0.10, 2)
                    total_amount = round(subtotal + tax, 2)
                    
                    dummy_bytes = f"{merchant}_{current_date.strftime('%Y-%m-%d')}_{total_amount}".encode('utf-8')
                    m_hash = hashlib.md5(dummy_bytes).hexdigest()
                    
                    raw_lines = [f"{merchant.upper()} RESTAURANT", f"DATE: {current_date.strftime('%Y-%m-%d')}", "-------------------------"]
                    for name, uprice, qty, tprice, _ in item_details:
                        raw_lines.append(f"{qty} {name:<18} @ {uprice:.2f}    {tprice:.2f}")
                    raw_lines.extend(["-------------------------", f"SUBTOTAL:          {subtotal:.2f}", f"TAX (10%):          {tax:.2f}", f"TOTAL:             {total_amount:.2f}"])
                    raw_text_content = "\n".join(raw_lines)

                    receipt = models.Receipt(
                        user_id=user.id,
                        store_name=merchant,
                        total_amount=total_amount,
                        tax_amount=tax,
                        date=current_date.strftime("%Y-%m-%d"),
                        duplicate_hash=m_hash,
                        ocr_avg_confidence=round(random.uniform(90.0, 98.0), 1),
                        raw_text=raw_text_content
                    )
                    db.add(receipt)
                    db.commit()
                    
                    for name, unit_price, qty, tprice, cat in item_details:
                        db.add(models.ReceiptItem(
                            receipt_id=receipt.id,
                            name=name,
                            price=unit_price,
                            quantity=qty,
                            category=cat,
                            ocr_confidence=round(random.uniform(88.0, 98.5), 1)
                        ))
                    db.commit()
                    created_count += 1

            # 4. Travel (Gasoline/Uber): Every 10 days
            if current_date.day % 10 == 0:
                if random.random() < 0.8:
                    merchant = "Indian Oil" if random.random() < 0.6 else "Uber"
                    items_pool = merchants[merchant]["items"]
                    chosen_items = random.sample(items_pool, k=random.randint(1, len(items_pool)))
                    
                    item_details = []
                    subtotal = 0.0
                    for name, unit_price, cat in chosen_items:
                        qty = 1
                        total_item_price = round(unit_price * qty, 2)
                        subtotal += total_item_price
                        item_details.append((name, unit_price, qty, total_item_price, cat))
                        
                    tax = round(subtotal * 0.05, 2)
                    total_amount = round(subtotal + tax, 2)
                    
                    dummy_bytes = f"{merchant}_{current_date.strftime('%Y-%m-%d')}_{total_amount}".encode('utf-8')
                    m_hash = hashlib.md5(dummy_bytes).hexdigest()
                    
                    raw_lines = [f"{merchant.upper()} OUTLET", f"DATE: {current_date.strftime('%Y-%m-%d')}", "-------------------------"]
                    for name, uprice, qty, tprice, _ in item_details:
                        raw_lines.append(f"{qty} {name:<18} @ {uprice:.2f}    {tprice:.2f}")
                    raw_lines.extend(["-------------------------", f"SUBTOTAL:          {subtotal:.2f}", f"TAX (5%):           {tax:.2f}", f"TOTAL:             {total_amount:.2f}"])
                    raw_text_content = "\n".join(raw_lines)

                    receipt = models.Receipt(
                        user_id=user.id,
                        store_name=merchant,
                        total_amount=total_amount,
                        tax_amount=tax,
                        date=current_date.strftime("%Y-%m-%d"),
                        duplicate_hash=m_hash,
                        ocr_avg_confidence=round(random.uniform(91.0, 98.5), 1),
                        raw_text=raw_text_content
                    )
                    db.add(receipt)
                    db.commit()
                    
                    for name, unit_price, qty, tprice, cat in item_details:
                        db.add(models.ReceiptItem(
                            receipt_id=receipt.id,
                            name=name,
                            price=unit_price,
                            quantity=qty,
                            category=cat,
                            ocr_confidence=round(random.uniform(89.0, 99.0), 1)
                        ))
                    db.commit()
                    created_count += 1

            # 5. Monthly Subscriptions: Netflix on the 15th
            if current_date.day == 15:
                # Add Netflix subscription charge (₹649.00)
                merchant = "Netflix"
                sub_price = 649.00
                
                dummy_bytes = f"Netflix_{current_date.strftime('%Y-%m-%d')}_{sub_price}".encode('utf-8')
                m_hash = hashlib.md5(dummy_bytes).hexdigest()
                
                raw_text_content = f"NETFLIX BILLING\nDATE: {current_date.strftime('%Y-%m-%d')}\n-------------------------\n1 Netflix Premium Subscription  649.00\n-------------------------\nTOTAL:             649.00"

                receipt = models.Receipt(
                    user_id=user.id,
                    store_name=merchant,
                    total_amount=sub_price,
                    tax_amount=0.0,
                    date=current_date.strftime("%Y-%m-%d"),
                    duplicate_hash=m_hash,
                    ocr_avg_confidence=99.0,
                    raw_text=raw_text_content
                )
                db.add(receipt)
                db.commit()
                
                db.add(models.ReceiptItem(
                    receipt_id=receipt.id,
                    name="Netflix Premium Subscription",
                    price=sub_price,
                    quantity=1,
                    category="Others",
                    ocr_confidence=99.5
                ))
                db.commit()
                created_count += 1

            # 6. Monthly Subscriptions: Spotify on the 28th
            if current_date.day == 28:
                # Add Spotify subscription (₹119.00)
                merchant = "Spotify"
                sub_price = 119.00
                
                dummy_bytes = f"Spotify_{current_date.strftime('%Y-%m-%d')}_{sub_price}".encode('utf-8')
                m_hash = hashlib.md5(dummy_bytes).hexdigest()
                
                raw_text_content = f"SPOTIFY BILLING\nDATE: {current_date.strftime('%Y-%m-%d')}\n-------------------------\n1 Spotify Premium Audio         119.00\n-------------------------\nTOTAL:             119.00"

                receipt = models.Receipt(
                    user_id=user.id,
                    store_name=merchant,
                    total_amount=sub_price,
                    tax_amount=0.0,
                    date=current_date.strftime("%Y-%m-%d"),
                    duplicate_hash=m_hash,
                    ocr_avg_confidence=99.5,
                    raw_text=raw_text_content
                )
                db.add(receipt)
                db.commit()
                
                db.add(models.ReceiptItem(
                    receipt_id=receipt.id,
                    name="Spotify Premium Audio",
                    price=sub_price,
                    quantity=1,
                    category="Beverages",  # Mocked category misclassification to be parsed or just standard
                    ocr_confidence=99.8
                ))
                db.commit()
                created_count += 1

            current_date += timedelta(days=1)

        # 3. Add a high anomaly purchase 10 days ago (Severe price spike)
        spike_date = now - timedelta(days=10)
        merchant = "Indian Oil"
        total_amount = 8500.00  # Normal gas is ~2500.00
        
        dummy_bytes = f"IndianOil_SPIKE_{spike_date.strftime('%Y-%m-%d')}".encode('utf-8')
        m_hash = hashlib.md5(dummy_bytes).hexdigest()
        
        raw_text_content = f"INDIAN OIL STATION\nDATE: {spike_date.strftime('%Y-%m-%d')}\n-------------------------\n1 Deluxe Heavy Transport Fuel   8200.00\n1 Truck Super Washer Extra      300.00\n-------------------------\nTOTAL:             8500.00"

        receipt = models.Receipt(
            user_id=user.id,
            store_name=merchant,
            total_amount=total_amount,
            tax_amount=425.00,
            date=spike_date.strftime("%Y-%m-%d"),
            duplicate_hash=m_hash,
            ocr_avg_confidence=97.0,
            raw_text=raw_text_content
        )
        db.add(receipt)
        db.commit()
        
        db.add(models.ReceiptItem(
            receipt_id=receipt.id,
            name="Deluxe Heavy Transport Fuel Premium",
            price=8200.00,
            quantity=1,
            category="Travel",
            ocr_confidence=98.0
        ))
        db.add(models.ReceiptItem(
            receipt_id=receipt.id,
            name="Truck Super Washer Extra",
            price=300.00,
            quantity=1,
            category="Travel",
            ocr_confidence=95.0
        ))
        db.commit()
        created_count += 1

        print(f"Generated {created_count} historical receipts!")
        
        # 4. Trigger the smart anomaly analysis pipeline to parse patterns, spikes, and subscriptions
        print("Running Anomaly & Spending Trend detector on seeded data...")
        trends.detect_all_trends_and_anomalies(db, user.id)
        print("Successfully detected subscriptions, trends, and spending anomalies!")
        
    except Exception as e:
        print(f"Seeding failed: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
