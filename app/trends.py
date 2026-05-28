from datetime import datetime, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session
from . import models
from .insights import format_inr
import numpy as np

def detect_all_trends_and_anomalies(db: Session, user_id: int):
    """
    Scans a user's transaction history and runs ML/statistical heuristics to:
    1. Detect unusual price spikes (anomalies).
    2. Detect recurring store patterns.
    3. Detect subscription-like expenses.
    Inserts newly discovered items into the `anomalies` database table.
    """
    # Clear existing anomalies for this user to rebuild a fresh state
    db.query(models.Anomaly).filter(models.Anomaly.user_id == user_id).delete()
    db.commit()

    receipts = db.query(models.Receipt).filter(models.Receipt.user_id == user_id).order_by(models.Receipt.date).all()
    if len(receipts) < 3:
        return

    # 1. Unusual Purchase Spikes (Total Amount Anomalies)
    amounts = [r.total_amount for r in receipts]
    mean_amount = np.mean(amounts)
    std_amount = np.std(amounts)
    
    # Avoid dividing by zero or extremely low std
    if std_amount > 1.0:
        for r in receipts:
            z_score = (r.total_amount - mean_amount) / std_amount
            if z_score > 2.2:  # > 2.2 std deviations
                new_anomaly = models.Anomaly(
                    user_id=user_id,
                    type="unusual_spike",
                    title="Unusual Purchase Spike Detected",
                    description=f"You spent {format_inr(r.total_amount)} at {r.store_name} on {r.date}. This is significantly higher than your typical average transaction size of {format_inr(mean_amount)}.",
                    severity="high" if z_score > 3.0 else "warning",
                    detected_at=datetime.utcnow()
                )
                db.add(new_anomaly)

    # 2. Subscription-like Expense Detection (Repeating similar charge size every ~30 days)
    # Group items by name and price, check for ~30 day spacing intervals
    item_history = defaultdict(list)
    for r in receipts:
        for item in r.items:
            # Group by normalized lowercase name and rounded price
            key = (item.name.lower().strip(), round(item.price, 1))
            try:
                date_val = datetime.strptime(r.date, "%Y-%m-%d")
                item_history[key].append(date_val)
            except ValueError:
                continue

    for (name, price), dates in item_history.items():
        if len(dates) >= 3:
            # Check intervals between consecutive dates
            intervals = []
            for i in range(1, len(dates)):
                delta = (dates[i] - dates[i-1]).days
                intervals.append(delta)
                
            # If average interval is 27-33 days and standard dev is low, it's a subscription!
            avg_interval = np.mean(intervals)
            std_interval = np.std(intervals)
            if 27 <= avg_interval <= 33 and std_interval < 4.0:
                new_anomaly = models.Anomaly(
                    user_id=user_id,
                    type="subscription",
                    title=f"New Subscription Detected: {name.title()}",
                    description=f"We detected a monthly recurring expense of {format_inr(price)} for '{name.title()}' repeating approximately every {int(round(avg_interval))} days.",
                    severity="info",
                    detected_at=datetime.utcnow()
                )
                db.add(new_anomaly)

    # 3. Recurring Store Visit Patterns (e.g., Visiting store on the same day of week)
    merchant_days = defaultdict(list)
    for r in receipts:
        try:
            date_val = datetime.strptime(r.date, "%Y-%m-%d")
            # Day of week: 0 = Monday, 6 = Sunday
            merchant_days[r.store_name.lower().strip()].append(date_val.weekday())
        except ValueError:
            continue
            
    for store_name, weekdays in merchant_days.items():
        if len(weekdays) >= 4:
            # Count weekday frequencies
            counts = defaultdict(int)
            for w in weekdays:
                counts[w] += 1
                
            for w, count in counts.items():
                # If visited on this day in >= 60% of all visits to this merchant
                ratio = count / len(weekdays)
                if ratio >= 0.6 and len(weekdays) >= 4:
                    day_names = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"]
                    new_anomaly = models.Anomaly(
                        user_id=user_id,
                        type="recurring_pattern",
                        title=f"Recurring Spending Trend at {store_name.title()}",
                        description=f"You visit {store_name.title()} primarily on {day_names[w]} ({int(ratio * 100)}% of your visits happen on this day of the week).",
                        severity="info",
                        detected_at=datetime.utcnow()
                    )
                    db.add(new_anomaly)

    db.commit()
