# 🚀 AI-Powered Public Service Feedback Sentiment Analyzer

An AI-powered web application that analyzes public service feedback using Natural Language Processing (NLP). The system automatically detects language, analyzes sentiment, extracts keywords, generates summaries, detects spam and duplicate comments, and presents insights through an interactive dashboard.

---

## 📌 Features

* 🌍 Multilingual Language Detection (English, Tamil, Hindi)
* 😊 Multilingual Sentiment Analysis
* 📝 Automatic Keyword Extraction
* 📄 AI-Powered Comment Summarization
* 🏷️ Intelligent Action Tags
* 🚫 Spam Detection
* 🔁 Duplicate Comment Detection
* ☁️ Interactive Word Cloud
* 📊 Pie Chart & Bar Chart Visualization
* 🔍 Search & Filter Comments
* 📂 CSV Export Reports
* 💾 MySQL Database Integration
* 🎨 Modern Responsive React Dashboard

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Vite
* CSS
* Recharts

### Backend

* FastAPI
* Python

### Database

* MySQL

### AI / NLP

* XLM-RoBERTa
* Transformers (Hugging Face)

---

## 📂 Project Structure

```text
Sentiment_Analysis/
│
├── backend/
│   ├── main.py
│   ├── sentiment.py
│   ├── keywords.py
│   ├── summary.py
│   ├── spam_detector.py
│   ├── action_tags.py
│   ├── wordcloud_generator.py
│   └── database.py
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## ⚙️ Installation

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🌟 Workflow

1. User enters a public feedback comment.
2. System detects the language.
3. AI analyzes the sentiment.
4. Keywords are extracted.
5. Summary is generated.
6. Spam and duplicate comments are detected.
7. Action tags are assigned.
8. Results are visualized using charts and an interactive word cloud.
9. Reports can be exported as CSV.

---

## 📊 Dashboard Features

* Sentiment Distribution
* Language Detection
* Keyword Extraction
* Summary
* Action Tags
* Search History
* Interactive Word Cloud
* Pie Chart
* Bar Chart
* CSV Export

---

## 🎯 Project Objectives

* Reduce manual effort in analyzing stakeholder feedback.
* Support multilingual public comments.
* Help policymakers quickly identify public opinions.
* Provide AI-driven insights through an interactive dashboard.

---

## 🚀 Future Enhancements

* User Authentication
* Role-Based Access Control
* Cloud Deployment
* Real-Time Notifications
* Advanced Analytics
* More Indian Language Support

---

## 👩‍💻 Developed By

**Lavanya Sethuraman**

B.Tech Information Technology

---

## 📜 License

This project is developed for academic and learning purposes.
