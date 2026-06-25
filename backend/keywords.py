from keybert import KeyBERT
from langdetect import detect
from collections import Counter
import re

kw_model = KeyBERT()

STOP_WORDS = {
    "the", "is", "are", "am", "a", "an", "and", "or", "to", "of", "in",
    "on", "for", "with", "this", "that", "it", "as", "be", "by", "from",
    "was", "were", "has", "have", "had", "i", "we", "you", "they", "he",
    "she", "my", "our", "your", "their", "but", "not", "so", "if", "then",
    "there", "here", "about", "into", "than", "too", "very", "can", "will",
    "should", "would", "could", "also", "more", "less", "need", "needs"
}


def extract_keywords(text: str, top_n: int = 5):
    if not text or not text.strip():
        return []

    try:
        lang = detect(text)
    except Exception:
        lang = "en"

    # Tamil or Hindi — KeyBERT cannot handle these scripts
    # Use Unicode word frequency extraction instead
    if lang in ("ta", "hi"):
        unicode_words = re.findall(
            r"[\u0900-\u097F]{2,}|[\u0B80-\u0BFF]{2,}", text
        )
        if unicode_words:
            counts = Counter(unicode_words)
            return [word for word, _ in counts.most_common(top_n)]

        # Fallback for mixed script Tamil/Hindi with English words
        english_words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
        english_filtered = [w for w in english_words if w not in STOP_WORDS]
        counts = Counter(english_filtered)
        return [word for word, _ in counts.most_common(top_n)]

    # English — use KeyBERT
    try:
        keywords = kw_model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 2),
            stop_words="english",
            top_n=top_n,
        )
        return [keyword[0] for keyword in keywords]
    except Exception:
        # Fallback if KeyBERT fails for any reason
        english_words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
        english_filtered = [w for w in english_words if w not in STOP_WORDS]
        counts = Counter(english_filtered)
        return [word for word, _ in counts.most_common(top_n)]