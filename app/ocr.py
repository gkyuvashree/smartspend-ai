import cv2
import numpy as np
import pytesseract
import re
import os
from typing import Dict, List, Any, Tuple

# Set Tesseract executable path directly for Windows
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Global lazy-loaded EasyOCR reader to avoid importing torch on system startup
_easyocr_reader = None

def get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        print("[SmartSpend AI] Initializing EasyOCR engine (en, CPU mode)...")
        # Initialize reader (gpu=False for server cpu environments)
        _easyocr_reader = easyocr.Reader(['en'], gpu=False)
    return _easyocr_reader

def get_perspective_corrected_image(img: np.ndarray) -> np.ndarray:
    """
    Detects receipt outlines and applies a perspective warp to flatten/crop it.
    If no valid 4-corner receipt boundary is detected, returns the original image.
    """
    orig = img.copy()
    height, width = img.shape[:2]
    
    # 1. Resize to constant height for contour scanning
    ratio = height / 800.0
    resized = cv2.resize(img, (int(width / ratio), 800))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    
    # 2. Smooth to merge textures, keep boundaries sharp
    blurred = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # 3. Detect edges
    edged = cv2.Canny(blurred, 50, 150)
    
    # 4. Find largest external contours
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    
    receipt_contour = None
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            receipt_contour = approx
            break
            
    if receipt_contour is None:
        # No 4-vertex quadrilateral contour found, return original image
        return orig
        
    # Scale coordinates back to original image scale
    pts = receipt_contour.reshape(4, 2) * ratio
    
    # Sort corner points: top-left, top-right, bottom-right, bottom-left
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]       # top-left
    rect[2] = pts[np.argmax(s)]       # bottom-right
    
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]     # top-right
    rect[3] = pts[np.argmax(diff)]     # bottom-left
    
    (tl, tr, br, bl) = rect
    
    # Compute horizontal distance width
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    # Compute vertical distance height
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    # Destination dimensions
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    # Warp perspective matrix
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(orig, M, (maxWidth, maxHeight))
    return warped

def enhance_receipt_image(img: np.ndarray) -> np.ndarray:
    """
    Applies production-grade preprocessing filters to enhance low-contrast text:
    - Shadow/glare envelope normalization (divides image by local background)
    - Grayscale conversion & CLAHE local contrast enhancement
    - Bilateral noise filtering
    - Text sharpening via 2D convolution kernel
    """
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()
        
    # 1. Shadow/Glare removal: Divide grayscale by median blurred background
    dilated = cv2.dilate(gray, np.ones((7,7), np.uint8))
    bg = cv2.medianBlur(dilated, 21)
    diff = cv2.absdiff(gray, bg)
    normalized = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)
    
    # 2. Denoise using bilateral filter (preserves edges, smooths interior noise)
    denoised = cv2.bilateralFilter(normalized, 9, 75, 75)
    
    # 3. Increase local contrast via CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contrast = clahe.apply(denoised)
    
    # 4. Sharpen text contours via 2D sharpening kernel filter
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(contrast, -1, kernel)
    
    return sharpened

def extract_ocr_data(image_path: str) -> Tuple[str, List[Dict[str, Any]], float, str]:
    """
    Runs advanced pre-processing and character recognition.
    Tries EasyOCR neural network model as primary, falling back to Tesseract OCR configuration.
    Returns: (raw_text, words_list, average_confidence, ocr_engine_used)
    """
    # Load original image
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Could not read image from path: " + image_path)
        
    # 1. Edge crop & flatten perspective
    try:
        cropped_img = get_perspective_corrected_image(img)
    except Exception as e:
        print(f"[SmartSpend AI] Perspective warp failed: {str(e)}. Falling back.")
        cropped_img = img.copy()
        
    # 2. Text enhancement filters
    try:
        processed_img = enhance_receipt_image(cropped_img)
        # Write processed image back over original path for visual review
        cv2.imwrite(image_path, processed_img)
    except Exception as e:
        print(f"[SmartSpend AI] Image enhancement failed: {str(e)}. Using raw cropped.")
        processed_img = cv2.cvtColor(cropped_img, cv2.COLOR_BGR2GRAY) if len(cropped_img.shape) == 3 else cropped_img
        
    raw_text = ""
    words_list = []
    total_confidence = 0.0
    valid_words_count = 0
    engine_used = "EasyOCR"

    # 3. Run EasyOCR primary reader
    try:
        reader = get_easyocr_reader()
        # Read text (paragraphs=False to get word coordinates, detail=1)
        results = reader.readtext(image_path, detail=1)
        
        if not results:
            raise ValueError("EasyOCR returned empty result. Triggering Tesseract fallback.")
            
        lines_buffer = []
        for bbox, text, conf in results:
            clean_text = text.strip()
            if not clean_text:
                continue
                
            conf_percent = float(conf) * 100.0
            
            # Map EasyOCR bounding box corners to coordinates
            xs = [pt[0] for pt in bbox]
            ys = [pt[1] for pt in bbox]
            left = int(min(xs))
            top = int(min(ys))
            width = int(max(xs) - min(xs))
            height = int(max(ys) - min(ys))
            
            words_list.append({
                "text": clean_text,
                "confidence": conf_percent,
                "left": left,
                "top": top,
                "width": width,
                "height": height
            })
            
            total_confidence += conf_percent
            valid_words_count += 1
            lines_buffer.append(clean_text)
            
        # Reconstruct rough raw text by grouping boxes into strings
        raw_text = "\n".join(lines_buffer)
        
    # Fallback to Tesseract OCR
    except Exception as err:
        print(f"[SmartSpend AI] Primary EasyOCR failed: {str(err)}. Falling back to Tesseract OCR.")
        engine_used = "Tesseract"
        
        # Optimize Tesseract configs for receipt scanning (column-based text parsing)
        custom_config = r'--oem 3 --psm 4'  # Assume single column of varying size
        
        try:
            # First try psm 4
            raw_text = pytesseract.image_to_string(processed_img, config=custom_config)
            ocr_data = pytesseract.image_to_data(processed_img, config=custom_config, output_type=pytesseract.Output.DICT)
        except Exception:
            # Fallback to psm 6 (single uniform block of text)
            custom_config = r'--oem 3 --psm 6'
            raw_text = pytesseract.image_to_string(processed_img, config=custom_config)
            ocr_data = pytesseract.image_to_data(processed_img, config=custom_config, output_type=pytesseract.Output.DICT)

        n_boxes = len(ocr_data['text'])
        for i in range(n_boxes):
            text = ocr_data['text'][i].strip()
            conf = float(ocr_data['conf'][i])
            
            if text and conf > -1:
                words_list.append({
                    "text": text,
                    "confidence": conf,
                    "left": ocr_data['left'][i],
                    "top": ocr_data['top'][i],
                    "width": ocr_data['width'][i],
                    "height": ocr_data['height'][i]
                })
                total_confidence += conf
                valid_words_count += 1

    avg_confidence = (total_confidence / valid_words_count) if valid_words_count > 0 else 0.0
    return raw_text, words_list, avg_confidence, engine_used

def parse_receipt(raw_text: str, words_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Advanced Receipt parsing using regular expressions and heuristics.
    Correctly extracts: Store Name, Transaction Date, Subtotal, Tax/GST, Line Items, Quantities, and Total.
    """
    # 1. OCR Text Cleanup & Normalization
    raw_lines = raw_text.split('\n')
    lines = []
    for line in raw_lines:
        line_str = line.strip()
        if not line_str:
            continue
        # Normalize multiple spaces to a single space
        line_str = re.sub(r'\s+', ' ', line_str)
        # Remove noisy symbols like | [ ] { } !
        line_str = re.sub(r'[\|\[\]\!\{\}\\]', '', line_str)
        # Fix space-separated cents: e.g. "618 50" -> "618.50"
        line_str = re.sub(r'\b(\d+)\s+(\d{2})\b', r'\1.\2', line_str)
        lines.append(line_str.strip())
        
    num_lines = len(lines)
    
    # 2. Receipt Section Partition (Header, Items, Footer)
    # Define relative boundaries: Top 30% = Header, Bottom 30% = Footer
    header_idx = max(1, int(num_lines * 0.3))
    footer_idx = max(1, int(num_lines * 0.7))
    # If the receipt is very short, adjust boundaries
    if num_lines < 8:
        header_idx = min(2, num_lines)
        footer_idx = max(num_lines - 2, 0)
        
    header_lines = lines[:header_idx]
    footer_lines = lines[footer_idx:]
    
    # 3. Parse Store Name
    store_name = "Unknown Merchant"
    ignore_patterns = re.compile(
        r'(welcome|tax|invoice|receipt|sale|cash|check|slip|customer|copy|transaction|station|store\s*#|tel|phone|retail|date|time|cashier|points|member)', 
        re.IGNORECASE
    )
    # Prefer looking in the header section, fallback to top lines
    store_candidates = header_lines if header_lines else lines[:5]
    for line in store_candidates:
        if not ignore_patterns.search(line) and len(line) > 2:
            clean_store = re.sub(r'^[^\w]+|[^\w]+$', '', line).strip()
            if len(clean_store) > 2:
                store_name = clean_store
                break
                
    # 4. Parse Date
    date_str = datetime_to_iso_date() # Default to today
    date_regexes = [
        r'(\b\d{4}[-/.]\d{2}[-/.]\d{2}\b)',  # YYYY-MM-DD
        r'(\b\d{2}[-/.]\d{2}[-/.]\d{4}\b)',  # DD-MM-YYYY or MM-DD-YYYY
        r'(\b\d{2}[-/.]\d{2}[-/.]\d{2}\b)'   # DD-MM-YY or MM-DD-YY
    ]
    
    found_date = False
    for line in lines:
        for r in date_regexes:
            match = re.search(r, line)
            if match:
                raw_date = match.group(1)
                normalized = re.sub(r'[/.]', '-', raw_date)
                parts = normalized.split('-')
                
                if len(parts) == 3:
                    if len(parts[0]) == 4:  # YYYY-MM-DD
                        date_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
                        found_date = True
                    elif len(parts[2]) == 4:  # DD-MM-YYYY / MM-DD-YYYY
                        v1, v2, v3 = int(parts[0]), int(parts[1]), int(parts[2])
                        if v1 > 12: # DD-MM-YYYY
                            date_str = f"{v3:04d}-{v2:02d}-{v1:02d}"
                        else: # MM-DD-YYYY fallback
                            date_str = f"{v3:04d}-{v1:02d}-{v2:02d}"
                        found_date = True
                    elif len(parts[2]) == 2:  # YY short format
                        v1, v2, v3 = int(parts[0]), int(parts[1]), int(parts[2])
                        year = 2000 + v3
                        if v1 > 12:
                            date_str = f"{year}-{v2:02d}-{v1:02d}"
                        else:
                            date_str = f"{year}-{v1:02d}-{v2:02d}"
                        found_date = True
            if found_date:
                break
        if found_date:
            break

    # 5. Lines Pricing Extraction
    items = []
    extracted_prices = []
    
    # Matches pricing patterns at the end of a line (e.g. Milk 3.99, Bread $ 2.50)
    price_regex = re.compile(r'(.*?)\s+[\$₹€£¥]?\s*(\d+[\.,]\d{2})\s*$', re.IGNORECASE)
    
    # Exclude keywords representing tax, subtotals, or card details
    exclude_items_patterns = re.compile(
        r'(subtotal|tax|total|taxable|gst|vat|balance|change|cash|visa|mastercard|card|credit|debit|amex|paid|payment|due|discount|savings|rounding|change)', 
        re.IGNORECASE
    )
    
    # Matches quantity strings like: '2 x 1.99', '3x 2.50', '5 @ 1.20', '1.5 kg @ 4.00'
    qty_regex = re.compile(r'\b(\d+)\s*(?:x|X|@)\s*[\$₹€£¥]?\s*(\d+[\.,]\d{2})\b')

    tax_amount = 0.0
    tax_regex = re.compile(r'\b(gst|tax|vat|sales\s*tax)\b', re.IGNORECASE)

    for idx, line in enumerate(lines):
        match = price_regex.match(line)
        if match:
            item_name = match.group(1).strip()
            price_val = float(match.group(2).replace(',', '.'))
            extracted_prices.append((idx, price_val))
            
            # Check if this line is tax/GST
            if tax_regex.search(item_name) and not re.search(r'\bsubtotal\b', item_name, re.IGNORECASE):
                tax_amount = max(tax_amount, price_val)
                continue

            if not exclude_items_patterns.search(item_name) and len(item_name) > 2:
                item_confidence = calculate_line_confidence(item_name, words_list)
                qty = 1
                unit_price = price_val
                
                qty_match = qty_regex.search(line)
                if qty_match:
                    qty = int(qty_match.group(1))
                    unit_price = float(qty_match.group(2).replace(',', '.'))
                else:
                    qty_prefix_match = re.match(r'^(\d+)\s+(.+)$', item_name)
                    if qty_prefix_match:
                        potential_qty = int(qty_prefix_match.group(1))
                        if potential_qty > 0 and potential_qty <= 10:
                            qty = potential_qty
                            item_name = qty_prefix_match.group(2).strip()
                            unit_price = round(price_val / qty, 2)
                
                items.append({
                    "name": clean_item_name(item_name),
                    "price": unit_price,
                    "quantity": qty,
                    "ocr_confidence": item_confidence
                })

    # Compute items sum and maximum item price for heuristic validations
    items_sum = sum(it["price"] * it["quantity"] for it in items)
    max_item_price = max((it["price"] * it["quantity"] for it in items), default=0.0)

    # 6. Candidate Total Amount Extraction and Scoring
    level1_keywords = re.compile(r'\b(total\s*amount|amount\s*payable|final\s*amount|net\s*amount|grand\s*total)\b', re.IGNORECASE)
    level2_keywords = re.compile(r'\b(total\s*rate|total\s*due|amount\s*due)\b', re.IGNORECASE)
    level3_keywords = re.compile(r'\b(total|due|paid|cash|visa|mastercard|card|net)\b', re.IGNORECASE)
    
    candidates = {}
    
    decimal_pattern = re.compile(r'[\$₹€£¥]?\s*(\d+[\.,]\d{2})\b')
    four_digit_pattern = re.compile(r'\b(\d{2})(\d{2})\b') # For corrections like 2020 -> 20.20
    
    for idx, line in enumerate(lines):
        # Find all decimal candidates on this line
        decimals = decimal_pattern.findall(line)
        for dec in decimals:
            val = float(dec.replace(',', '.'))
            if val > 0:
                if val not in candidates:
                    candidates[val] = []
                candidates[val].append((idx, "decimal"))
                
        # Find 4-digit number candidates on this line (near total keywords)
        if level3_keywords.search(line):
            four_digits = four_digit_pattern.findall(line)
            for fd in four_digits:
                val = float(f"{fd[0]}.{fd[1]}")
                if val > 0:
                    if val not in candidates:
                        candidates[val] = []
                    candidates[val].append((idx, "4digit_correction"))

    # Also pull candidates from extracted_prices just in case
    for idx, price_val in extracted_prices:
        if price_val > 0:
            if price_val not in candidates:
                candidates[price_val] = []
            if not any(c[0] == idx for c in candidates[price_val]):
                candidates[price_val].append((idx, "extracted_price"))

    scored_candidates = []
    
    for val, occurrences in candidates.items():
        for idx, source in occurrences:
            score = 0
            breakdown = {}
            line_text = lines[idx]
            
            # Heuristic 1: Keyword Proximity
            if level1_keywords.search(line_text):
                score += 100
                breakdown["level1_keyword"] = 100
            elif level2_keywords.search(line_text):
                score += 90
                breakdown["level2_keyword"] = 90
            elif level3_keywords.search(line_text):
                score += 70
                breakdown["level3_keyword"] = 70
            else:
                if idx > 0 and level3_keywords.search(lines[idx-1]):
                    score += 50
                    breakdown["preceding_line_keyword"] = 50
            
            # Heuristic 2: Section Weight
            if idx >= footer_idx:
                score += 40
                breakdown["footer_section"] = 40
            elif idx < header_idx:
                score -= 50
                breakdown["header_section"] = -50
            else:
                score += 10
                breakdown["middle_section"] = 10
                
            # Heuristic 3: Sum Compatibility
            if val < max_item_price:
                # Total shouldn't be less than the single largest item price
                # unless there is a discount or correction line on this candidate line
                if not re.search(r'\b(discount|savings|less|off|minus|credit)\b', line_text, re.IGNORECASE):
                    score -= 150
                    breakdown["less_than_max_item"] = -150
            else:
                if items_sum > 0:
                    diff_from_sum = abs(val - items_sum)
                    diff_from_sum_tax = abs(val - (items_sum + tax_amount))
                    
                    if diff_from_sum < 0.05:
                        score += 100
                        breakdown["matches_items_sum"] = 100
                    elif diff_from_sum_tax < 0.05:
                        score += 90
                        breakdown["matches_sum_plus_tax"] = 90
                    elif 0.9 * items_sum <= val <= 1.35 * items_sum:
                        score += 60
                        breakdown["close_to_items_sum"] = 60
            
            # Heuristic 4: Source correction adjustments
            if source == "4digit_correction":
                score -= 10
                breakdown["digit_correction_penalty"] = -10
                
            scored_candidates.append({
                "value": val,
                "line_idx": idx,
                "line_text": line_text,
                "score": score,
                "breakdown": breakdown,
                "source": source
            })

    # Sort candidates by score descending
    scored_candidates = sorted(scored_candidates, key=lambda x: x["score"], reverse=True)
    
    selected_total = 0.0
    confidence = 90
    
    if scored_candidates:
        top_candidate = scored_candidates[0]
        if top_candidate["score"] >= -50:
            selected_total = top_candidate["value"]
            base_score = top_candidate["score"]
            confidence = min(99, max(50, int(base_score)))
        else:
            selected_total = items_sum if items_sum > 0 else 0.0
            confidence = 60
    else:
        selected_total = items_sum if items_sum > 0 else 0.0
        confidence = 50

    # Debug mode visibility
    print("\n--- [SmartSpend AI] DEBUG RECEIPT TOTAL PARSING ---")
    print(f"Merchant: {store_name} | Date: {date_str} | Sum of items: {items_sum:.2f} | Tax/GST parsed: {tax_amount:.2f}")
    print(f"Receipt text partitions: Header: {header_idx} lines, Items: {footer_idx - header_idx} lines, Footer: {num_lines - footer_idx} lines")
    print("All Scored Candidates:")
    for i, c in enumerate(scored_candidates[:8]):
        print(f"  {i+1}. Value: {c['value']:.2f} (Score: {c['score']}) | Source: {c['source']} | Line: '{c['line_text']}' | Breakdown: {c['breakdown']}")
    print(f"Final Selected Total: {selected_total:.2f} (Confidence: {confidence}%)")
    print("----------------------------------------------------\n")

    # If no items parsed but we have a total amount, add placeholder
    if not items and selected_total > 0:
        items.append({
            "name": f"Transaction at {store_name}",
            "price": selected_total,
            "quantity": 1,
            "ocr_confidence": 95.0
        })

    return {
        "store_name": store_name,
        "date": date_str,
        "items": items,
        "tax_amount": tax_amount,
        "gst": tax_amount,  # matches tax_amount synonym
        "total_amount": selected_total,
        "confidence": confidence
    }

def datetime_to_iso_date() -> str:
    from datetime import datetime
    return datetime.utcnow().strftime("%Y-%m-%d")

def clean_item_name(name: str) -> str:
    cleaned = re.sub(r'^[\d\s\.\*\-\#\+]+', '', name) # Remove leading numbers/codes
    cleaned = re.sub(r'\s*\b\d+x\b.*$', '', cleaned, flags=re.IGNORECASE) # Remove qty codes
    cleaned = re.sub(r'[\*\#\@]+', '', cleaned)
    return cleaned.strip()

def calculate_line_confidence(line_text: str, words_list: List[Dict[str, Any]]) -> float:
    tokens = [t.lower() for t in re.split(r'\W+', line_text) if t]
    if not tokens:
        return 100.0
        
    matching_confidences = []
    for word in words_list:
        if word['text'].lower() in tokens:
            matching_confidences.append(word['confidence'])
            
    if matching_confidences:
        return sum(matching_confidences) / len(matching_confidences)
    
    return 90.0
