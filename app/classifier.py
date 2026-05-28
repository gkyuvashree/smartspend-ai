import re
from typing import Dict, List

# Predefined categories mapping keywords to labels
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "Groceries": [
        "milk", "egg", "eggs", "bread", "butter", "cheese", "yogurt", "cereal", 
        "flour", "sugar", "salt", "pepper", "rice", "pasta", "noodle", "oil", 
        "chicken", "beef", "pork", "fish", "meat", "apple", "banana", "tomato", 
        "onion", "garlic", "potato", "salad", "spinach", "vegetable", "fruit", 
        "organic", "whole foods", "supermarket", "walmart", "grocery", "produce"
    ],
    "Dining": [
        "burger", "pizza", "sushi", "pasta", "steak", "taco", "burrito", "salad bar",
        "restaurant", "cafe", "bistro", "diner", "eats", "grill", "pub", "bar", 
        "mcdonalds", "burger king", "subway", "starbucks", "dunkin", "tacobell", 
        "chipotle", "wendys", "kfc", "dominos", "pizza hut", "nandos", "cater", 
        "lunch", "dinner", "breakfast"
    ],
    "Snacks": [
        "chips", "cookie", "cookies", "chocolate", "candy", "popcorn", "crisps", 
        "nuts", "almond", "peanut", "gum", "donut", "doughnut", "muffin", "snack",
        "sweet", "sweets", "ice cream", "gelato", "marshmallow", "cracker"
    ],
    "Travel": [
        "uber", "lyft", "taxi", "cab", "metro", "subway pass", "train", "bus", 
        "flight", "airline", "delta", "united", "hotel", "motel", "airbnb", 
        "stay", "inn", "gas", "fuel", "chevron", "shell", "exxon", "mobil", 
        "petrol", "parking", "toll", "car rental", "hertz", "avis"
    ],
    "Personal Care": [
        "shampoo", "soap", "toothpaste", "toothbrush", "deodorant", "lotion", 
        "cream", "perfume", "makeup", "cosmetics", "salon", "barber", "haircut", 
        "pharmacy", "cvs", "walgreens", "boots", "medicine", "vitamin", "vitamins", 
        "bandage", "tissue", "toilet paper"
    ],
    "Beverages": [
        "coke", "soda", "cola", "pepsi", "sprite", "fanta", "juice", "water", 
        "tea", "coffee", "beer", "wine", "whiskey", "vodka", "gin", "rum", 
        "cocktail", "liquor", "champagne", "energy drink", "red bull", "monster", 
        "smoothie", "milkshake", "cider"
    ]
}

def get_character_ngrams(text: str, n: int = 3) -> List[str]:
    """Generates character n-grams for string matching."""
    text = text.lower().strip()
    # Replace non-alphanumeric with spaces
    text = re.sub(r'[^a-z0-9 ]', '', text)
    if len(text) < n:
        return [text]
    return [text[i:i+n] for i in range(len(text) - n + 1)]

def calculate_similarity(item_name: str, keyword: str) -> float:
    """
    Computes a Jaccard similarity index based on character 3-grams
    to allow robust string comparison (resilient to spelling mistakes).
    """
    item_ngrams = set(get_character_ngrams(item_name, 3))
    keyword_ngrams = set(get_character_ngrams(keyword, 3))
    
    intersection = item_ngrams.intersection(keyword_ngrams)
    union = item_ngrams.union(keyword_ngrams)
    
    return len(intersection) / len(union) if union else 0.0

def classify_item(item_name: str) -> str:
    """
    Classifies a receipt line item name into one of the 7 spending categories.
    Uses:
    1. Exact or partial token matching (high weight).
    2. Character 3-gram string Jaccard similarity for misspelled terms.
    """
    cleaned_name = item_name.lower().strip()
    
    # Split name into tokens to search for direct word matches first
    tokens = re.split(r'\W+', cleaned_name)
    tokens = [t for t in tokens if t]
    
    # Match direct keywords
    category_scores = {category: 0.0 for category in CATEGORY_KEYWORDS.keys()}
    
    # 1. Direct Token Match (Very high weight)
    for token in tokens:
        for category, keywords in CATEGORY_KEYWORDS.items():
            if token in keywords:
                category_scores[category] += 2.0
                
    # 2. String Substring Match (Medium weight)
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in cleaned_name or cleaned_name in keyword:
                category_scores[category] += 1.0

    # 3. 3-Gram Jaccard Similarity (Low weight fallback for fuzzy match)
    best_fuzzy_score = 0.0
    best_fuzzy_category = None
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            sim = calculate_similarity(cleaned_name, keyword)
            if sim > best_fuzzy_score:
                best_fuzzy_score = sim
                best_fuzzy_category = category
                
    if best_fuzzy_score > 0.35 and best_fuzzy_category:
        category_scores[best_fuzzy_category] += best_fuzzy_score
        
    # Find the category with highest accumulated score
    max_score = 0.0
    selected_category = "Others"
    
    for category, score in category_scores.items():
        if score > max_score:
            max_score = score
            selected_category = category
            
    return selected_category
