from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from sqlalchemy.orm import Session
from . import models, insights
from .insights import format_inr

def generate_financial_report_pdf(db: Session, user: models.User) -> BytesIO:
    """
    Generates a beautifully formatted PDF report of the user's spending habits
    using ReportLab. Returns the PDF as a BytesIO in-memory buffer.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    # Pre-fetch financial stats & insights
    stats = insights.calculate_insights_and_predictions(db, user.id)
    
    # Pre-fetch user anomalies
    anomalies = db.query(models.Anomaly).filter(models.Anomaly.user_id == user.id).all()
    
    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#8B5CF6")    # Violet accent
    c_success = colors.HexColor("#10B981")    # Emerald accent
    c_dark = colors.HexColor("#0B0F19")       # Deep fintech navy
    c_light_bg = colors.HexColor("#F3F4F6")   # Soft grey
    
    # Helper to convert ₹ standard string to safe PDF Rs. representation
    def to_pdf_currency(val: float) -> str:
        return format_inr(val).replace("₹", "Rs. ")

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=c_dark,
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor("#6B7280"),
        spaceAfter=30
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=c_primary,
        spaceBefore=20,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor("#374151"),
        leading=14,
        spaceAfter=10
    )
    
    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=6
    )

    story = []

    # --- COVER / HEADER ---
    story.append(Paragraph("SmartSpend AI", title_style))
    story.append(Paragraph(
        f"Executive Wealth & Spending Analysis Report<br/>"
        f"Prepared for: <b>{user.username}</b> ({user.email})<br/>"
        f"Date Generated: {datetime.utcnow().strftime('%B %d, %Y')} | Scope: Lifetime Data History",
        subtitle_style
    ))
    
    story.append(Spacer(1, 15))

    # --- FINANCIAL SCORECARD TABLE ---
    health = stats["health_score"]
    health_color = "#10B981" if health >= 80 else ("#F59E0B" if health >= 60 else "#EF4444")
    
    scorecard_data = [
        [
            Paragraph("<b>Total Spending</b>", body_style),
            Paragraph("<b>Receipts Processed</b>", body_style),
            Paragraph("<b>Financial Health Score</b>", body_style)
        ],
        [
            Paragraph(f"<font size=16 color='{c_primary.hexval()}'><b>{to_pdf_currency(stats['total_spend'])}</b></font>", body_style),
            Paragraph(f"<font size=16 color='#374151'><b>{stats['receipt_count']} Receipts</b></font>", body_style),
            Paragraph(f"<font size=16 color='{health_color}'><b>{health} / 100</b></font>", body_style)
        ]
    ]
    
    scorecard_table = Table(scorecard_data, colWidths=[2.2*inch, 2.2*inch, 2.6*inch])
    scorecard_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 12),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E5E7EB")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    
    story.append(scorecard_table)
    story.append(Spacer(1, 20))

    # --- CATEGORY BREAKDOWN SECTION ---
    story.append(Paragraph("Category Spending Breakdown", section_title_style))
    story.append(Paragraph(
        "Below is the breakdown of your expenses mapped into smart spending categories.",
        body_style
    ))
    
    # Build breakdown table rows
    table_rows = [["Category", "Transaction Count", "Total Amount", "Budget Share"]]
    for item in stats["category_breakdown"]:
        table_rows.append([
            item["category"],
            str(item["item_count"]),
            to_pdf_currency(item['amount']),
            f"{item['percentage']}%"
        ])
        
    breakdown_table = Table(table_rows, colWidths=[2.2*inch, 1.6*inch, 1.6*inch, 1.6*inch])
    breakdown_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E5E7EB")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(breakdown_table)
    story.append(Spacer(1, 20))

    # --- AI RECOMMENDATIONS & SAVINGS PANEL ---
    story.append(Paragraph("Smart Spending AI Insights & Alerts", section_title_style))
    
    # Add Insights List
    for insight in stats["insights"]:
        # Standard bullet representation
        story.append(Paragraph(f"• {insight}", bullet_style))
        
    if not stats["insights"]:
        story.append(Paragraph("No spending anomalies detected this cycle. Your financials are on track!", body_style))
        
    story.append(Spacer(1, 15))
    
    # Add Anomalies
    if anomalies:
        story.append(Paragraph("<b>Detected Spending Spikes & Patterns:</b>", body_style))
        for a in anomalies:
            severity_label = f"<font color='red'><b>[{a.severity.upper()}]</b></font>" if a.severity in ["high", "warning"] else f"<b>[{a.severity.upper()}]</b>"
            story.append(Paragraph(
                f"• {severity_label} <b>{a.title}</b>: {a.description}",
                bullet_style
            ))
        story.append(Spacer(1, 15))

    # Add Predictions
    pred = stats["predictions"]
    story.append(Paragraph("AI Spending Predictions & Forecasts", section_title_style))
    story.append(Paragraph(
        f"Based on your daily spending trajectory, our linear trend models estimate:<br/>"
        f"• Projected spending for the **next 7 days**: <b>{to_pdf_currency(pred['next_7_days'])}</b><br/>"
        f"• Projected spending for the **next 30 days**: <b>{to_pdf_currency(pred['next_30_days'])}</b>",
        body_style
    ))
    
    story.append(Spacer(1, 20))
    story.append(Paragraph("Thank you for using SmartSpend AI to automate your wealth and financial sanity.", subtitle_style))

    # Build Document
    doc.build(story)
    buffer.seek(0)
    return buffer
