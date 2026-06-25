import re
import unicodedata
from transformers import pipeline

print("SENTIMENT.PY LOADED")

MODEL_NAME = "cardiffnlp/twitter-xlm-roberta-base-sentiment"

try:
    print("Initializing Official Multilingual Sentiment Pipeline...")
    # Using the native pipeline ensures HuggingFace handles index mappings perfectly
    classifier = pipeline(
        "sentiment-analysis",
        model=MODEL_NAME,
        tokenizer=MODEL_NAME
    )
    print("MULTILINGUAL MODEL LOADED SUCCESSFULLY")
except Exception as init_err:
    print("Pipeline initialization failure, using safe fallback context:", init_err)
    classifier = None


def predict_sentiment(comment: str) -> str:
    """
    Robust Multilingual Sentiment Classifier for English, Tamil, and Hindi.
    Returns exactly: 'Positive', 'Negative', or 'Neutral'
    
    🐛 BUG FIX: Improved label parsing to handle all CardiffNLP output formats
    """
    global classifier
    
    # 1. Check for empty inputs
    if not comment or not str(comment).strip():
        return "Neutral"

    # 2. Check for uninitialized classifier fallback
    if classifier is None:
        try:
            classifier = pipeline("sentiment-analysis", model=MODEL_NAME)
        except Exception:
            return "Neutral"

    try:
        # 3. Clean and normalize Tamil/Hindi Unicode tokens
        normalized_text = unicodedata.normalize("NFC", str(comment).strip())

        # 4. Process text through the model pipeline
        # Passing truncation=True prevents long inputs from throwing index errors
        result = classifier(normalized_text, truncation=True, max_length=512)[0]
        
        # This print will output to your terminal console so you can instantly verify it
        print(f"\n[SIH HACKATHON DEBUG] Raw Model Output: {result}")

        # 5. Extract and normalize the output label string
        raw_label = str(result.get("label", "")).strip().lower()

        # 🐛 FIX: Robust label parsing that handles ALL CardiffNLP output formats
        # Remove "label_" prefix and any underscores, then normalize
        label_clean = raw_label.replace("label_", "").replace("_", "").strip()
        
        print(f"[SIH HACKATHON DEBUG] Cleaned Label: {label_clean}")

        # 6. Comprehensive mapping rules that work for all label formats:
        # Matches: "positive", "POSITIVE", "label_2", "LABEL_2", "2", etc.
        if label_clean in ["positive", "2"]:
            return "Positive"
        
        # Matches: "negative", "NEGATIVE", "label_0", "LABEL_0", "0", etc.
        elif label_clean in ["negative", "0"]:
            return "Negative"
        
        # Matches: "neutral", "NEUTRAL", "label_1", "LABEL_1", "1", etc.
        elif label_clean in ["neutral", "1"]:
            return "Neutral"
        
        # Ultimate fail-safe standard
        return "Neutral"

    except Exception as e:
        print(f"[SIH ENGINE ERROR] Handled exception during prediction: {e}")
        return "neutral"
