from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from . import models
from typing import Dict, List, Any
import numpy as np

def format_inr(number: float) -> str:
    """Formats a float to Indian Rupee (INR) standard: ₹1,23,456.78"""
    sign = "-" if number < 0 else ""
    number = abs(number)
    val = round(number, 2)
    s = f"{val:.2f}"
    parts = s.split('.')
    integer_part = parts[0]
    decimal_part = parts[1]
    
    if len(integer_part) <= 3:
        formatted_int = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        groups = []
        while len(remaining) > 0:
            groups.append(remaining[-2:])
            remaining = remaining[:-2]
        groups.reverse()
        formatted_int = ",".join(groups) + "," + last_three
        
    return f"₹{sign}{formatted_int}.{decimal_part}"

def calculate_insights_and_predictions(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Computes financial health scores, week-over-week summaries, smart savings recommendations,
    and runs a local linear regression projection to estimate next-week and next-month spending.
    """
    # Initialize default structures
    insights = []
    savings_suggestions = []
    predictions = {"next_7_days": 0.0, "next_30_days": 0.0}
    
    receipts = db.query(models.Receipt).filter(models.Receipt.user_id == user_id).order_by(models.Receipt.date).all()
    if not receipts:
        return {
            "total_spend": 0.0,
            "receipt_count": 0,
            "health_score": 100,
            "category_breakdown": [],
            "insights": ["Welcome! Upload your first receipt to generate smart AI insights in Rupees."],
            "savings_suggestions": [],
            "predictions": predictions
        }

    # Basic tallies
    total_spend = sum(r.total_amount for r in receipts)
    receipt_count = len(receipts)

    # 1. Category-wise Aggregation
    category_totals = db.query(
        models.ReceiptItem.category,
        func.sum(models.ReceiptItem.price).label("amount"),
        func.count(models.ReceiptItem.id).label("count")
    ).join(models.Receipt).filter(models.Receipt.user_id == user_id).group_by(models.ReceiptItem.category).all()
    
    category_breakdown = []
    category_spend_map = {}
    for cat, amt, cnt in category_totals:
        category_spend_map[cat] = amt
        category_breakdown.append({
            "category": cat,
            "amount": amt,
            "percentage": round((amt / total_spend) * 100, 1) if total_spend > 0 else 0.0,
            "item_count": cnt
        })

    # Sort breakdown by amount descending
    category_breakdown = sorted(category_breakdown, key=lambda x: x["amount"], reverse=True)

    # 2. Week-Over-Week Analysis
    now = datetime.utcnow()
    last_week_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    prev_week_start = (now - timedelta(days=14)).strftime("%Y-%m-%d")

    this_week_spend = sum(r.total_amount for r in receipts if r.date >= last_week_start)
    prev_week_spend = sum(r.total_amount for r in receipts if prev_week_start <= r.date < last_week_start)

    if prev_week_spend > 0:
        diff_pct = ((this_week_spend - prev_week_spend) / prev_week_spend) * 100
        if diff_pct > 15:
            insights.append(f"Your spending increased rapidly by {diff_pct:.1f}% this week compared to last week.")
        elif diff_pct < -15:
            insights.append(f"Awesome! Your weekly spending is down by {abs(diff_pct):.1f}% compared to last week.")
        else:
            insights.append("Your week-over-week spending remains relatively stable.")
    else:
        insights.append("Your weekly spending pattern looks balanced.")

    # 3. High Discretionary Spending Insights
    wants_categories = ["Snacks", "Dining", "Beverages"]
    needs_categories = ["Groceries", "Travel", "Personal Care"]
    
    wants_spend = sum(category_spend_map.get(cat, 0.0) for cat in wants_categories)
    needs_spend = sum(category_spend_map.get(cat, 0.0) for cat in needs_categories)
    other_spend = category_spend_map.get("Others", 0.0)
    
    total_classified = wants_spend + needs_spend + other_spend
    
    # 4. Financial Health Score (Base: 100)
    # Deduct points if Wants > Needs or if high spending detected in non-essentials
    health_score = 100
    if total_classified > 0:
        wants_ratio = wants_spend / total_classified
        # Deduct up to 40 points if wants are higher than 40% of budget
        if wants_ratio > 0.4:
            health_score -= int((wants_ratio - 0.4) * 100)
            
    # Deduct up to 10 points for increasing weekly budget trajectory
    if prev_week_spend > 0 and this_week_spend > prev_week_spend:
        health_score -= 10
        
    health_score = max(30, min(100, health_score)) # Clamp between 30 and 100

    # 5. Smart Monthly Savings Suggestions
    # If Dining > 20% of spending, suggest cooking home cooked meals
    dining_amt = category_spend_map.get("Dining", 0.0)
    dining_pct = (dining_amt / total_spend) * 100 if total_spend > 0 else 0.0
    if dining_pct > 20.0 and dining_amt > 50:
        savings_suggestions.append({
            "category": "Dining",
            "title": "Reduce Dining Out Costs",
            "description": f"You spend {dining_pct:.1f}% of your budget on Dining ({format_inr(dining_amt)}). Try preparing meals at home just 2 times a week.",
            "potential_savings": dining_amt * 0.3  # 30% reduction
        })

    # If Snacks > 10% of spending
    snacks_amt = category_spend_map.get("Snacks", 0.0)
    snacks_pct = (snacks_amt / total_spend) * 100 if total_spend > 0 else 0.0
    if snacks_pct > 10.0 and snacks_amt > 20:
        savings_suggestions.append({
            "category": "Snacks",
            "title": "Buy Snacks in Bulk",
            "description": f"Snacks account for {snacks_pct:.1f}% of your spending ({format_inr(snacks_amt)}). Buying multi-packs or shopping at discount superstores can cut snack expenses.",
            "potential_savings": snacks_amt * 0.4
        })

    # If Beverages > 10%
    beverages_amt = category_spend_map.get("Beverages", 0.0)
    beverages_pct = (beverages_amt / total_spend) * 100 if total_spend > 0 else 0.0
    if beverages_pct > 10.0 and beverages_amt > 25:
        savings_suggestions.append({
            "category": "Beverages",
            "title": "Limit Premium Beverages",
            "description": f"You spent {format_inr(beverages_amt)} on beverages. High spending detected. Buying a reusable water filter or brewing coffee at home would yield rapid savings.",
            "potential_savings": beverages_amt * 0.5
        })
        
    # Append top suggestions to insights
    for suggestion in savings_suggestions[:2]:
        insights.append(f"AI Tip: {suggestion['description']} Potential savings: {format_inr(suggestion['potential_savings'])}/mo.")

    # 6. Future Predicted Spending via Linear Trend Regression
    # Extract daily totals
    daily_spend = db.query(
        models.Receipt.date,
        func.sum(models.Receipt.total_amount).label("amount")
    ).filter(models.Receipt.user_id == user_id).group_by(models.Receipt.date).order_by(models.Receipt.date).all()

    if len(daily_spend) >= 3:
        dates_list = []
        amounts_list = []
        
        # Convert dates to relative integers
        base_date = datetime.strptime(daily_spend[0][0], "%Y-%m-%d")
        for date_str, amt in daily_spend:
            try:
                days_diff = (datetime.strptime(date_str, "%Y-%m-%d") - base_date).days
                dates_list.append(days_diff)
                amounts_list.append(amt)
            except ValueError:
                continue
                
        # Fit a standard local linear regression line: y = m*x + c
        if len(dates_list) >= 3:
            x = np.array(dates_list)
            y = np.array(amounts_list)
            A = np.vstack([x, np.ones(len(x))]).T
            m, c = np.linalg.lstsq(A, y, rcond=None)[0]
            
            # Predict for the next 7 and 30 days based on fitted slopes
            last_day = dates_list[-1]
            next_7_days_proj = sum(max(2.0, m * (last_day + i) + c) for i in range(1, 8))
            next_30_days_proj = sum(max(2.0, m * (last_day + i) + c) for i in range(1, 31))
            
            predictions["next_7_days"] = round(next_7_days_proj, 2)
            predictions["next_30_days"] = round(next_30_days_proj, 2)
    else:
        # Simple moving average fallback
        daily_average = total_spend / len(receipts) if receipts else 0.0
        predictions["next_7_days"] = round(daily_average * 7, 2)
        predictions["next_30_days"] = round(daily_average * 30, 2)

    return {
        "total_spend": round(total_spend, 2),
        "receipt_count": receipt_count,
        "health_score": health_score,
        "category_breakdown": category_breakdown,
        "insights": insights,
        "savings_suggestions": savings_suggestions,
        "predictions": predictions
    }
