from collections import Counter
import csv
import io
import re

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langdetect import detect
import mysql.connector
from mysql.connector import Error
from backend.sentiment import predict_sentiment
from backend.keywords import extract_keywords

app = FastAPI(title="Smart India Hackathon Sentiment Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = "1234"
DB_NAME = "sentiment_analysis"

POSITIVE_WORDS = {
    "good", "great", "excellent", "amazing", "helpful", "useful", "nice",
    "happy", "satisfied", "improve", "improved", "best", "better", "fast",
    "easy", "support", "successful", "clear", "beneficial", "positive",
    "smooth", "clean", "effective", "quick", "available", "working"
}

NEGATIVE_WORDS = {
    "bad", "poor", "worst", "terrible", "slow", "problem", "issue",
    "difficult", "hard", "angry", "delay", "delayed", "failed", "failure",
    "error", "bug", "complaint", "negative", "unhappy", "confusing",
    "broken", "dirty", "corruption", "unsafe", "shortage", "frequent"
}

STOP_WORDS = {
    "the", "is", "are", "am", "a", "an", "and", "or", "to", "of", "in",
    "on", "for", "with", "this", "that", "it", "as", "be", "by", "from",
    "was", "were", "has", "have", "had", "i", "we", "you", "they", "he",
    "she", "my", "our", "your", "their", "but", "not", "so", "if", "then",
    "there", "here", "about", "into", "than", "too", "very", "can", "will",
    "should", "would", "could", "also", "more", "less", "need", "needs"
}


def create_server_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def create_database_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
    )


def initialize_database():
    try:
        server_connection = create_server_connection()
        server_cursor = server_connection.cursor()
        server_cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        server_connection.commit()
        server_cursor.close()
        server_connection.close()

        db_connection = create_database_connection()
        db_cursor = db_connection.cursor()
        db_cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                comment_text TEXT NOT NULL,
                sentiment VARCHAR(20) NOT NULL
            )
            """
        )
        db_connection.commit()
        db_cursor.close()
        db_connection.close()
    except Error as error:
        print("Database initialization failed:", error)


initialize_database()


def clean_words(text: str):
    # Match English words (3+ letters) AND Tamil/Hindi Unicode words
    english_words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    unicode_words = re.findall(r"[\u0900-\u097F]{2,}|[\u0B80-\u0BFF]{2,}", text)
    english_filtered = [w for w in english_words if w not in STOP_WORDS]
    return english_filtered + unicode_words


def detect_language(comment: str) -> str:
    if not comment or not comment.strip():
        return "unknown"
    try:
        lang_code = detect(comment)
        lang_mapping = {
            "en": "English",
            "ta": "Tamil",
            "hi": "Hindi"
        }
        return lang_mapping.get(lang_code, lang_code)
    except Exception:
        return "unknown"


def analyze_sentiment(comment: str):
    words = clean_words(comment)
    positive_score = sum(1 for word in words if word in POSITIVE_WORDS)
    negative_score = sum(1 for word in words if word in NEGATIVE_WORDS)

    if positive_score > negative_score:
        return "Positive"

    if negative_score > positive_score:
        return "Negative"

    return "Neutral"


def generate_summary(comment: str):
    cleaned_comment = comment.strip()

    if not cleaned_comment:
        return "No summary available."

    sentences = re.split(r"(?<=[.!?])\s+", cleaned_comment)
    sentences = [sentence.strip() for sentence in sentences if sentence.strip()]

    if len(sentences) > 1:
        return sentences[0]

    words = cleaned_comment.split()

    if len(words) <= 18:
        return cleaned_comment

    return " ".join(words[:18]) + "..."


def generate_action_tags(comment: str, sentiment: str):
    text = comment.lower()
    tags = []

    if any(word in text for word in ["road", "traffic", "transport", "bus", "rail", "bridge"]):
        tags.append("Infrastructure")

    if any(word in text for word in ["school", "college", "education", "student", "teacher", "classroom"]):
        tags.append("Education")

    if any(word in text for word in ["hospital", "health", "doctor", "medicine", "clinic", "patient"]):
        tags.append("Healthcare")

    if any(word in text for word in ["water", "electricity", "power", "clean", "waste", "garbage", "drainage"]):
        tags.append("Public Services")

    if any(word in text for word in ["delay", "problem", "issue", "complaint", "bad", "poor", "failed"]):
        tags.append("Needs Attention")

    if sentiment == "Positive":
        tags.append("Positive Feedback")

    if sentiment == "Negative":
        tags.append("Urgent Review")

    if not tags:
        tags.append("General Feedback")

    return list(dict.fromkeys(tags))


def detect_spam(comment: str):
    text = comment.lower().strip()
    words = text.split()

    spam_keywords = [
        "lottery", "winner", "free money", "click here", "buy now",
        "discount", "offer", "cash prize", "subscribe now"
    ]

    is_spam = (
        any(keyword in text for keyword in spam_keywords)
        or text.count("http") >= 2
        or text.count("www") >= 2
        or bool(re.search(r"(.)\1{5,}", text))
        or (len(words) > 6 and len(set(words)) <= 2)
    )

    return {
        "is_spam": is_spam,
        "label": "Spam" if is_spam else "Not Spam",
        "reason": (
            "Suspicious promotional or repeated content detected."
            if is_spam
            else "No spam pattern detected."
        ),
    }


def detect_duplicate(comment: str) -> dict:
    try:
        connection = create_database_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT id, comment_text FROM comments WHERE LOWER(TRIM(comment_text)) = LOWER(TRIM(%s)) LIMIT 1",
            (comment,)
        )

        existing = cursor.fetchone()

        cursor.close()
        connection.close()

        if existing:
            return {
                "is_duplicate": True,
                "label": "Duplicate",
                "matched_id": existing["id"],
                "reason": f"This comment already exists with ID {existing['id']}."
            }

        return {
            "is_duplicate": False,
            "label": "Unique",
            "matched_id": None,
            "reason": "No matching comment found in the database."
        }

    except Error as error:
        return {
            "is_duplicate": False,
            "label": "Unknown",
            "matched_id": None,
            "reason": f"Duplicate check failed: {str(error)}"
        }


def build_word_cloud_data(comment_list):
    all_words = []

    for comment in comment_list:
        all_words.extend(clean_words(comment))

    word_counts = Counter(all_words)

    return [
        {"text": word, "value": count}
        for word, count in word_counts.most_common(40)
    ]


def save_comment(comment: str, sentiment: str):
    try:
        connection = create_database_connection()
        cursor = connection.cursor()

        cursor.execute(
            "INSERT INTO comments (comment_text, sentiment) VALUES (%s, %s)",
            (comment, sentiment),
        )

        connection.commit()
        inserted_id = cursor.lastrowid

        cursor.close()
        connection.close()

        return inserted_id

    except Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"MySQL insert error: {str(error)}"
        )


@app.get("/")
def home():
    return {
        "message": "Smart India Hackathon Sentiment Analysis API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }


@app.post("/analyze")
def analyze_comment(comment: str = Query(..., min_length=1)):
    cleaned_comment = comment.strip()

    if not cleaned_comment:
        raise HTTPException(
            status_code=400,
            detail="Comment cannot be empty"
        )

    # Duplicate check BEFORE saving so matched_id is accurate
    duplicate = detect_duplicate(cleaned_comment)

    # Multilingual Language Detection
    language = detect_language(cleaned_comment)
    sentiment = predict_sentiment(cleaned_comment)

    # Multilingual keyword extraction via keywords.py
    keywords = extract_keywords(cleaned_comment)

    summary = generate_summary(cleaned_comment)
    action_tags = generate_action_tags(cleaned_comment, sentiment)
    spam = detect_spam(cleaned_comment)

    # Only save to DB if comment is not a duplicate
    if not duplicate["is_duplicate"]:
        comment_id = save_comment(cleaned_comment, sentiment)
    else:
        comment_id = duplicate["matched_id"]

    return {
        "id": comment_id,
        "comment": cleaned_comment,
        "language": language,
        "sentiment": sentiment,
        "keywords": keywords,
        "summary": summary,
        "action_tags": action_tags,
        "spam": spam,
        "duplicate": duplicate,
    }


@app.get("/comments")
def get_comments():
    try:
        connection = create_database_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT id, comment_text, sentiment FROM comments ORDER BY id DESC"
        )

        rows = cursor.fetchall()

        cursor.close()
        connection.close()

        return {
            "comments": rows
        }

    except Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"MySQL fetch error: {str(error)}"
        )


@app.get("/search")
def search_comments(
    query: str = Query(""),
    sentiment: str = Query("All"),
):
    try:
        connection = create_database_connection()
        cursor = connection.cursor(dictionary=True)

        sql = "SELECT id, comment_text, sentiment FROM comments WHERE 1=1"
        values = []

        if query.strip():
            sql += " AND comment_text LIKE %s"
            values.append(f"%{query.strip()}%")

        if sentiment != "All":
            sql += " AND sentiment = %s"
            values.append(sentiment)

        sql += " ORDER BY id DESC"

        cursor.execute(sql, values)
        rows = cursor.fetchall()

        cursor.close()
        connection.close()

        return {
            "comments": rows
        }

    except Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"MySQL search error: {str(error)}"
        )


@app.get("/stats")
def get_stats():
    try:
        connection = create_database_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT id, comment_text, sentiment FROM comments")
        rows = cursor.fetchall()

        sentiment_counts = {
            "Positive": 0,
            "Negative": 0,
            "Neutral": 0,
        }

        all_comment_texts = []

        for row in rows:
            sentiment = row["sentiment"]
            comment_text = row["comment_text"]

            if sentiment in sentiment_counts:
                sentiment_counts[sentiment] += 1

            all_comment_texts.append(comment_text)

        cursor.close()
        connection.close()

        return {
            "total_comments": len(rows),
            "sentiment_counts": sentiment_counts,
            "word_cloud": build_word_cloud_data(all_comment_texts),
        }

    except Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"MySQL stats error: {str(error)}"
        )


@app.get("/export-csv")
def export_csv():
    try:
        connection = create_database_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT id, comment_text, sentiment FROM comments ORDER BY id DESC"
        )

        rows = cursor.fetchall()

        cursor.close()
        connection.close()

        output = io.StringIO()
        writer = csv.writer(output)

        # 1. Changed header layout structure: ID, Sentiment, Comment Text
        writer.writerow(["id", "sentiment", "comment_text"])

        # 2. Re-arranged record rendering parameters to place long text at the end
        for row in rows:
            writer.writerow([
                row.get("id", ""),
                row.get("sentiment", ""),
                row.get("comment_text", ""),
            ])

        output.seek(0)

        # 3. Added encoded utf-8-sig stream sequence for flawless Excel readability
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=sentiment_analysis_comments.csv"
            },
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"CSV export failed: {str(error)}"
        )