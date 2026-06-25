from transformers import pipeline

print("Loading Multilingual Sentiment Model...")

classifier = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-xlm-roberta-base-sentiment"
)

print("Model Loaded Successfully!")

def predict_sentiment(comment):

    try:
        result = classifier(comment)[0]

        print("MODEL OUTPUT =", result)

        label = result["label"]

        # Handle both label formats
        if label in ["LABEL_2", "Positive", "POSITIVE"]:
            return "Positive"

        elif label in ["LABEL_0", "Negative", "NEGATIVE"]:
            return "Negative"

        else:
            return "Neutral"

    except Exception as e:
        print("Sentiment Error:", e)
        return "Neutral"