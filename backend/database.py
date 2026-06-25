import mysql.connector

conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="1234",
    database="sentiment_analysis"
)

print("Database Connected Successfully")