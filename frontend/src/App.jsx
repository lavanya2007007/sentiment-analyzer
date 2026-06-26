import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8002",
});

const defaultStats = {
  total_comments: 0,
  sentiment_counts: {
    Positive: 0,
    Negative: 0,
    Neutral: 0,
  },
  word_cloud: [],
};

const sentimentMeta = {
  Positive: {
    color: "#16a34a",
    soft: "#dcfce7",
    text: "#166534",
  },
  Negative: {
    color: "#ef4444",
    soft: "#fee2e2",
    text: "#991b1b",
  },
  Neutral: {
    color: "#2563eb",
    soft: "#dbeafe",
    text: "#1e40af",
  },
};

function isSpamResult(data) {
  const label = String(data?.spam?.label || "").trim().toLowerCase();
  return label.includes("spam") && !label.includes("not spam");
}

function isSpamComment(item) {
  const possibleLabels = [
    item?.spam?.label,
    item?.spam_label,
    item?.spam_status,
    item?.spam,
    item?.is_spam,
  ];

  return possibleLabels.some((value) => {
    if (value === true) return true;

    const label = String(value || "").trim().toLowerCase();
    return label.includes("spam") && !label.includes("not spam");
  });
}

function App() {
  const [comment, setComment] = useState("");
  const [result, setResult] = useState(null);
  const [comments, setComments] = useState([]);
  const [stats, setStats] = useState(defaultStats);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [isDuplicate, setIsDuplicate] = useState(false);

  const [selectedWord, setSelectedWord] = useState(null);
  const [wordFilteredComments, setWordFilteredComments] = useState([]);
  const [wordFilterLoading, setWordFilterLoading] = useState(false);

  const visibleComments = comments.filter((item) => !isSpamComment(item));

  const loadDashboard = useCallback(async () => {
    try {
      setError("");

      const [commentsResponse, statsResponse] = await Promise.all([
        API.get("/comments"),
        API.get("/stats"),
      ]);

      setComments(commentsResponse.data.comments || []);
      setStats({
        total_comments: statsResponse.data.total_comments || 0,
        sentiment_counts:
          statsResponse.data.sentiment_counts || defaultStats.sentiment_counts,
        word_cloud: statsResponse.data.word_cloud || [],
      });
    } catch {
      setError("Unable to load data. Please check backend and MySQL.");
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleAnalyze = async (event) => {
    event.preventDefault();

    const trimmedComment = comment.trim();

    if (!trimmedComment) {
      setError("Please enter a comment.");
      setIsDuplicate(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);
      setIsDuplicate(false);

      const response = await API.post("/analyze", null, {
        params: {
          comment: trimmedComment,
        },
      });

      if (response.data.duplicate?.is_duplicate) {
        setIsDuplicate(true);
        setError(
          `This comment already exists in the database with ID ${response.data.duplicate.matched_id}.`
        );
        setResult(null);
        return;
      }

      setResult(response.data);
      setComment("");

      if (!isSpamResult(response.data)) {
        await loadDashboard();
      }
    } catch (apiError) {
      setIsDuplicate(false);
      setError(apiError.response?.data?.detail || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setError("");
      setIsDuplicate(false);

      const response = await API.get("/search", {
        params: {
          query: searchQuery,
          sentiment: sentimentFilter,
        },
      });

      setComments(response.data.comments || []);
    } catch {
      setError("Search failed.");
    }
  };

  const handleReset = async () => {
    setSearchQuery("");
    setSentimentFilter("All");
    setResult(null);
    setError("");
    setIsDuplicate(false);
    await loadDashboard();
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      setError("");
      setIsDuplicate(false);

      const response = await API.get("/export-csv", {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });

      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = fileUrl;
      link.download = "sentiment_analysis_comments.csv";
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(fileUrl);
    } catch (apiError) {
      setError(
        apiError.response?.data?.detail ||
          "CSV export failed. Please check backend."
      );
    } finally {
      setExporting(false);
    }
  };

  const handleWordClick = async (word) => {
    if (selectedWord === word) {
      setSelectedWord(null);
      setWordFilteredComments([]);
      return;
    }

    try {
      setWordFilterLoading(true);
      setSelectedWord(word);

      const response = await API.get("/search", {
        params: {
          query: word,
          sentiment: "All",
        },
      });

      setWordFilteredComments(
        (response.data.comments || []).filter((item) => !isSpamComment(item))
      );
    } catch {
      setWordFilteredComments([]);
    } finally {
      setWordFilterLoading(false);
    }
  };

  const handleClearWordFilter = () => {
    setSelectedWord(null);
    setWordFilteredComments([]);
  };

  let localPositive = 0;
  let localNegative = 0;
  let localNeutral = 0;

  visibleComments.forEach((c) => {
    const s = String(c.sentiment || "").trim().toLowerCase();

    if (s.includes("neg") || s === "n" || s.includes("minus")) {
      localNegative++;
    } else if (s.includes("pos") || s === "p" || s.includes("plus")) {
      localPositive++;
    } else {
      localNeutral++;
    }
  });

  const chartData = [
    {
      label: "Positive",
      value: localPositive,
      ...sentimentMeta.Positive,
    },
    {
      label: "Negative",
      value: localNegative,
      ...sentimentMeta.Negative,
    },
    {
      label: "Neutral",
      value: localNeutral,
      ...sentimentMeta.Neutral,
    },
  ];

  const maxBarValue = Math.max(
    chartData[0].value,
    chartData[1].value,
    chartData[2].value,
    1
  );

  const totalSentiments = chartData.reduce((sum, item) => sum + item.value, 0);

  let pieOffset = 0;
  const pieGradient =
    totalSentiments === 0
      ? "#fce7f3 0deg 360deg"
      : chartData
          .map((item) => {
            const start = pieOffset;
            const size = (item.value / totalSentiments) * 360;
            pieOffset += size;
            return `${item.color} ${start}deg ${pieOffset}deg`;
          })
          .join(", ");

  const maxWordValue =
    stats.word_cloud.length > 0
      ? Math.max(...stats.word_cloud.map((w) => w.value))
      : 1;

  return (
    <div className="dashboard-shell">
      <style>{globalStyles}</style>

      <header className="hero">
        <div className="hero-content">
          <div>
            <p className="eyebrow">AI Public Service Intelligence</p>
            <h1>Public Feedback Sentiment Analyzer</h1>
            <p className="hero-copy">
              Monitor citizen feedback, detect intent, surface patterns, and
              turn public comments into clear service insights.
            </p>
          </div>

          <button
            className="button button-export"
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
          >
            <span className="button-icon">CSV</span>
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>

        <div className="stats-strip">
          <StatCard label="Total Comments" value={visibleComments.length} />
          <StatCard label="Positive" value={localPositive} tone="positive" />
          <StatCard label="Negative" value={localNegative} tone="negative" />
          <StatCard label="Neutral" value={localNeutral} tone="neutral" />
        </div>
      </header>

      {isDuplicate && error ? (
        <div className="alert alert-duplicate">
          <div className="alert-icon">!</div>
          <div>
            <strong>Duplicate Comment Found</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : null}

      <main className="dashboard-grid">
        <section className="card analyze-card fade-in">
          <div className="card-header">
            <div>
              <p className="section-kicker">Live Analysis</p>
              <h2>Analyze Comment</h2>
            </div>
            <span className="status-pill live">Active</span>
          </div>

          <form onSubmit={handleAnalyze} className="analyze-form">
            <div className="floating-field">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder=" "
              />
              <label>Citizen comment</label>
            </div>

            <button
              className="button button-primary"
              type="submit"
              disabled={loading}
            >
              <span className="button-icon">AI</span>
              {loading ? "Analyzing..." : "Analyze Comment"}
            </button>
          </form>

          {result ? (
            <div className="result-card">
              <div className="result-header">
                <div>
                  <p className="section-kicker">Analysis Result</p>
                  <h3>Detected Insight</h3>
                </div>
                <span style={getSentimentStyle(result.sentiment)}>
                  {result.sentiment}
                </span>
              </div>

              <div className="summary-panel">
                <span>AI Summary</span>
                <p>{result.summary}</p>
              </div>

              <div className="result-grid">
                <InfoBadge label="Language" value={result.language || "unknown"} />
                <InfoBadge label="Spam" value={result.spam?.label || "Unknown"} />
                <InfoBadge
                  label="Duplicate"
                  value={result.duplicate?.label || "Unknown"}
                />
              </div>

              {result.spam?.reason ? (
                <div className="reason-box">
                  <span>Spam Reason</span>
                  <p>{result.spam.reason}</p>
                </div>
              ) : null}

              <TagGroup
                title="Keywords"
                items={result.keywords || []}
                className="keyword-chip"
              />

              <TagGroup
                title="Action Tags"
                items={result.action_tags || []}
                className="action-chip"
              />
            </div>
          ) : null}
        </section>

        <section className="card history-card fade-in">
          <div className="card-header">
            <div>
              <p className="section-kicker">Records</p>
              <h2>Search History</h2>
            </div>
            <span className="status-pill">{visibleComments.length} shown</span>
          </div>

          <div className="filter-grid">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search comments"
            />

            <select
              value={sentimentFilter}
              onChange={(event) => setSentimentFilter(event.target.value)}
            >
              <option value="All">All</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
              <option value="Neutral">Neutral</option>
            </select>
          </div>

          <div className="button-row">
            <button
              className="button button-secondary"
              type="button"
              onClick={handleSearch}
            >
              Search
            </button>
            <button
              className="button button-soft"
              type="button"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>

          <div className="comment-list">
            {visibleComments.length === 0 ? (
              <p className="empty-text">No comments found.</p>
            ) : (
              visibleComments.map((item) => (
                <article key={item.id} className="comment-card">
                  <p>{item.comment_text}</p>
                  <span style={getSentimentStyle(item.sentiment)}>
                    {item.sentiment}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card chart-card fade-in">
          <div className="card-header compact">
            <div>
              <p className="section-kicker">Overview</p>
              <h2>Sentiment Split</h2>
            </div>
          </div>

          <div className="pie-area">
            <div
              className="pie-chart"
              style={{
                background: `conic-gradient(${pieGradient})`,
              }}
            />

            <div className="legend">
              {chartData.map((item) => (
                <div key={item.label} className="legend-item">
                  <span style={{ backgroundColor: item.color }} />
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card chart-card fade-in">
          <div className="card-header compact">
            <div>
              <p className="section-kicker">Distribution</p>
              <h2>Sentiment Volume</h2>
            </div>
          </div>

          <div className="bar-chart">
            {chartData.map((item) => {
              const height =
                item.value === 0
                  ? 0
                  : Math.max((item.value / maxBarValue) * 100, 12);

              return (
                <div key={item.label} className="bar-column">
                  <div className="bar-value">{item.value}</div>

                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        height: `${height}%`,
                        background: `linear-gradient(180deg, ${item.color}, ${item.text})`,
                      }}
                    />
                  </div>

                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card word-card fade-in">
          <div className="card-header">
            <div>
              <p className="section-kicker">Keyword Intelligence</p>
              <h2>Interactive Word Cloud</h2>
            </div>

            <div className="word-actions">
              <span className="status-pill">
                {stats.word_cloud.length} keywords
              </span>

              {selectedWord ? (
                <button
                  className="button button-clear"
                  type="button"
                  onClick={handleClearWordFilter}
                >
                  Clear Filter
                </button>
              ) : null}
            </div>
          </div>

          <div className="word-cloud">
            {stats.word_cloud.length === 0 ? (
              <p className="empty-text">
                Word cloud will appear after comments are analyzed.
              </p>
            ) : (
              stats.word_cloud.map((word, index) => {
                const isSelected = selectedWord === word.text;
                const fontSize = 14 + Math.round((word.value / maxWordValue) * 32);
                const baseColor = cloudColors[index % cloudColors.length];

                return (
                  <span
                    key={`${word.text}-${index}`}
                    onClick={() => handleWordClick(word.text)}
                    title={`"${word.text}" - ${word.value} occurrence${
                      word.value !== 1 ? "s" : ""
                    }. Click to filter comments.`}
                    className={`cloud-word ${isSelected ? "selected" : ""}`}
                    style={{
                      fontSize: `${fontSize}px`,
                      color: isSelected ? "#ffffff" : baseColor,
                      backgroundColor: isSelected ? baseColor : "#ffffff",
                      borderColor: isSelected ? baseColor : "#fce7f3",
                      boxShadow: isSelected
                        ? `0 16px 34px ${baseColor}35`
                        : "0 10px 24px rgba(236, 72, 153, 0.08)",
                    }}
                  >
                    {word.text}
                  </span>
                );
              })
            )}
          </div>

          {selectedWord ? (
            <div className="word-results">
              <div className="word-result-header">
                <span className="selected-word">"{selectedWord}"</span>
                <span className="word-count">
                  {wordFilterLoading
                    ? "Searching..."
                    : `${wordFilteredComments.length} comment${
                        wordFilteredComments.length !== 1 ? "s" : ""
                      } found`}
                </span>
              </div>

              {wordFilterLoading ? (
                <div className="loading-box">Loading comments...</div>
              ) : wordFilteredComments.length === 0 ? (
                <p className="empty-text">
                  No comments found containing "{selectedWord}".
                </p>
              ) : (
                <div className="word-result-list">
                  {wordFilteredComments.map((item) => (
                    <article key={item.id} className="word-result-card">
                      <p>{highlightWord(item.comment_text, selectedWord)}</p>
                      <span style={getSentimentStyle(item.sentiment)}>
                        {item.sentiment}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, tone = "primary" }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoBadge({ label, value }) {
  return (
    <div className="info-badge">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TagGroup({ title, items, className }) {
  return (
    <div className="tag-section">
      <p>{title}</p>
      <div className="tag-wrap">
        {items.length === 0 ? (
          <span className="muted-chip">None</span>
        ) : (
          items.map((item) => (
            <span key={item} className={className}>
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function highlightWord(text, word) {
  if (!text || !word) return text;

  const parts = text.split(new RegExp(`(${word})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <mark key={index}>{part}</mark>
    ) : (
      part
    )
  );
}

function getSentimentStyle(sentiment) {
  const cleanKey = sentiment
    ? sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase()
    : "Neutral";
  const meta = sentimentMeta[cleanKey] || sentimentMeta.Neutral;

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 12px",
    borderRadius: "999px",
    fontWeight: "800",
    fontSize: "12px",
    backgroundColor: meta.soft,
    color: meta.text,
    border: `1px solid ${meta.color}26`,
    whiteSpace: "nowrap",
  };
}

const cloudColors = [
  "#ec4899",
  "#db2777",
  "#be185d",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
];

const globalStyles = `
  :root {
    --primary: #ec4899;
    --primary-dark: #db2777;
    --secondary: #f9a8d4;
    --background: #fff7fb;
    --card: #ffffff;
    --accent: #fce7f3;
    --border: #fbcfe8;
    --text: #1f2937;
    --muted: #6b7280;
    --shadow: 0 22px 55px rgba(236, 72, 153, 0.13);
    --soft-shadow: 0 14px 35px rgba(236, 72, 153, 0.1);
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: var(--background);
  }

  .dashboard-shell {
    min-height: 100vh;
    padding: 28px;
    color: var(--text);
    background:
      radial-gradient(circle at 10% 0%, rgba(249, 168, 212, 0.34), transparent 34%),
      radial-gradient(circle at 90% 10%, rgba(252, 231, 243, 0.95), transparent 30%),
      linear-gradient(180deg, #fff7fb 0%, #ffffff 48%, #fff7fb 100%);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .hero,
  .dashboard-grid,
  .alert {
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
  }

  .hero {
    padding: 30px;
    border: 1px solid var(--border);
    border-radius: 30px;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(252, 231, 243, 0.9)),
      linear-gradient(135deg, #fff7fb, #ffffff);
    box-shadow: var(--shadow);
    margin-bottom: 20px;
    overflow: hidden;
    position: relative;
  }

  .hero::after {
    content: "";
    position: absolute;
    width: 260px;
    height: 260px;
    right: -90px;
    top: -120px;
    border-radius: 999px;
    background: rgba(236, 72, 153, 0.12);
    pointer-events: none;
  }

  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
  }

  .eyebrow,
  .section-kicker {
    margin: 0 0 8px;
    color: var(--primary);
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .hero h1 {
    max-width: 760px;
    margin: 0;
    color: #111827;
    font-size: clamp(32px, 5vw, 58px);
    line-height: 1.02;
    letter-spacing: 0;
  }

  .hero-copy {
    max-width: 720px;
    margin: 16px 0 0;
    color: #5f6471;
    font-size: 16px;
    line-height: 1.7;
  }

  .stats-strip {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 28px;
  }

  .stat-card {
    min-height: 104px;
    padding: 18px;
    border: 1px solid var(--border);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 14px 30px rgba(236, 72, 153, 0.09);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 20px 38px rgba(236, 72, 153, 0.15);
  }

  .stat-card span {
    display: block;
    color: var(--muted);
    font-size: 13px;
    font-weight: 800;
  }

  .stat-card strong {
    display: block;
    margin-top: 10px;
    color: #111827;
    font-size: 34px;
    line-height: 1;
  }

  .stat-card.primary strong {
    color: var(--primary);
  }

  .stat-card.positive strong {
    color: #16a34a;
  }

  .stat-card.negative strong {
    color: #ef4444;
  }

  .stat-card.neutral strong {
    color: #2563eb;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 26px;
    padding: 24px;
    box-shadow: var(--soft-shadow);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 18px;
  }

  .card-header.compact {
    margin-bottom: 8px;
  }

  .card h2,
  .card h3 {
    margin: 0;
    color: #111827;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .card h2 {
    font-size: 22px;
  }

  .card h3 {
    font-size: 20px;
  }

  .analyze-card,
  .history-card {
    min-height: 660px;
  }

  .chart-card {
    min-height: 360px;
  }

  .word-card {
    grid-column: 1 / -1;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--primary-dark);
    border: 1px solid var(--border);
    font-size: 12px;
    font-weight: 900;
    white-space: nowrap;
  }

  .status-pill.live {
    background: #fdf2f8;
  }

  .button {
    border: 0;
    border-radius: 999px;
    min-height: 44px;
    padding: 12px 18px;
    font-weight: 900;
    cursor: pointer;
    transition: transform 170ms ease, box-shadow 170ms ease, opacity 170ms ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    white-space: nowrap;
  }

  .button:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.01);
  }

  .button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .button:disabled {
    opacity: 0.66;
    cursor: not-allowed;
  }

  .button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.24);
    font-size: 11px;
    font-weight: 900;
  }

  .button-primary,
  .button-export {
    color: white;
    background: linear-gradient(135deg, #ec4899, #db2777);
    box-shadow: 0 16px 30px rgba(236, 72, 153, 0.28);
  }

  .button-export {
    position: relative;
    z-index: 1;
  }

  .button-secondary {
    flex: 1;
    color: white;
    background: linear-gradient(135deg, #ec4899, #db2777);
    box-shadow: 0 12px 24px rgba(236, 72, 153, 0.22);
  }

  .button-soft {
    flex: 1;
    color: var(--primary-dark);
    background: #fff;
    border: 1px solid var(--border);
  }

  .button-clear {
    min-height: 34px;
    padding: 8px 13px;
    color: var(--primary-dark);
    background: #fff;
    border: 1px solid var(--border);
  }

  .alert {
    margin-bottom: 18px;
    border-radius: 20px;
    padding: 16px 18px;
    font-weight: 800;
    box-shadow: var(--soft-shadow);
  }

  .alert p {
    margin: 4px 0 0;
    font-weight: 700;
  }

  .alert-error {
    background: #fff1f2;
    color: #9f1239;
    border: 1px solid #fecdd3;
  }

  .alert-duplicate {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: #fff1f2;
    color: #9f1239;
    border: 1px solid #fecdd3;
  }

  .alert-icon {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: #e11d48;
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .analyze-form {
    display: grid;
    gap: 14px;
  }

  .floating-field {
    position: relative;
  }

  .floating-field textarea {
    width: 100%;
    min-height: 174px;
    resize: vertical;
    padding: 26px 16px 16px;
    border: 1px solid var(--border);
    border-radius: 22px;
    outline: none;
    color: #111827;
    background: #fffafd;
    font-size: 15px;
    line-height: 1.6;
    transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
  }

  .floating-field label {
    position: absolute;
    left: 16px;
    top: 16px;
    color: #8a6175;
    font-size: 14px;
    font-weight: 800;
    pointer-events: none;
    transition: transform 160ms ease, font-size 160ms ease, color 160ms ease;
  }

  .floating-field textarea:focus {
    border-color: var(--primary);
    background: #fff;
    box-shadow: 0 0 0 4px rgba(236, 72, 153, 0.11);
  }

  .floating-field textarea:focus + label,
  .floating-field textarea:not(:placeholder-shown) + label {
    transform: translateY(-9px);
    font-size: 11px;
    color: var(--primary);
  }

  .result-card {
    margin-top: 20px;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 24px;
    background: linear-gradient(180deg, #ffffff, #fff7fb);
  }

  .result-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .summary-panel,
  .reason-box {
    padding: 16px;
    border-radius: 18px;
    background: #fff;
    border: 1px solid var(--border);
  }

  .summary-panel span,
  .reason-box span,
  .tag-section p,
  .info-badge span {
    color: var(--primary-dark);
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .summary-panel p,
  .reason-box p {
    margin: 8px 0 0;
    color: #4b5563;
    line-height: 1.6;
  }

  .result-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 14px 0;
  }

  .info-badge {
    padding: 13px;
    border-radius: 18px;
    background: #fff;
    border: 1px solid var(--border);
    min-width: 0;
  }

  .info-badge strong {
    display: block;
    margin-top: 6px;
    color: #111827;
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .tag-section {
    margin-top: 16px;
  }

  .tag-section p {
    margin: 0 0 10px;
  }

  .tag-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .keyword-chip,
  .action-chip,
  .muted-chip {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 900;
  }

  .keyword-chip {
    background: var(--accent);
    color: var(--primary-dark);
    border: 1px solid var(--border);
  }

  .action-chip {
    background: #fdf2f8;
    color: #9d174d;
    border: 1px solid var(--border);
  }

  .muted-chip {
    background: #f9fafb;
    color: #6b7280;
    border: 1px solid #e5e7eb;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 150px;
    gap: 10px;
  }

  .filter-grid input,
  .filter-grid select {
    min-width: 0;
    width: 100%;
    min-height: 46px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    outline: none;
    background: #fffafd;
    color: #111827;
    font-weight: 700;
  }

  .filter-grid input:focus,
  .filter-grid select:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(236, 72, 153, 0.1);
    background: #fff;
  }

  .button-row {
    display: flex;
    gap: 10px;
    margin-top: 12px;
  }

  .comment-list,
  .word-result-list {
    scrollbar-width: thin;
    scrollbar-color: #f9a8d4 #fff7fb;
  }

  .comment-list {
    display: grid;
    gap: 12px;
    max-height: 452px;
    overflow-y: auto;
    padding: 4px 4px 4px 0;
    margin-top: 18px;
  }

  .comment-card,
  .word-result-card {
    padding: 15px;
    border-radius: 20px;
    background: #fffafd;
    border: 1px solid var(--border);
    transition: transform 170ms ease, box-shadow 170ms ease, background 170ms ease;
  }

  .comment-card:hover,
  .word-result-card:hover {
    transform: translateY(-2px);
    background: #fff;
    box-shadow: 0 14px 30px rgba(236, 72, 153, 0.12);
  }

  .comment-card p,
  .word-result-card p {
    margin: 0 0 12px;
    color: #4b5563;
    line-height: 1.55;
  }

  .empty-text {
    margin: 0;
    color: var(--muted);
    font-weight: 800;
  }

  .pie-area {
    min-height: 275px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 34px;
  }

  .pie-chart {
    width: 170px;
    height: 170px;
    border-radius: 50%;
    box-shadow:
      inset 0 0 0 16px #ffffff,
      0 20px 40px rgba(236, 72, 153, 0.16);
  }

  .legend {
    display: grid;
    gap: 12px;
    min-width: 165px;
  }

  .legend-item {
    display: grid;
    grid-template-columns: 14px minmax(70px, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 16px;
    background: #fff7fb;
    border: 1px solid var(--border);
  }

  .legend-item span {
    width: 14px;
    height: 14px;
    border-radius: 999px;
  }

  .legend-item p {
    margin: 0;
    color: #4b5563;
    font-weight: 800;
  }

  .legend-item strong {
    color: #111827;
  }

  .bar-chart {
    height: 275px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: end;
    gap: 24px;
    padding: 8px 8px 0;
  }

  .bar-column {
    height: 100%;
    display: grid;
    grid-template-rows: 30px 1fr 30px;
    align-items: end;
    justify-items: center;
  }

  .bar-value {
    color: #111827;
    font-size: 18px;
    font-weight: 900;
  }

  .bar-track {
    width: min(72px, 70%);
    height: 100%;
    border-radius: 999px;
    background: #fff0f7;
    border: 1px solid var(--border);
    display: flex;
    align-items: end;
    overflow: hidden;
  }

  .bar-fill {
    width: 100%;
    border-radius: 999px 999px 0 0;
    transition: height 350ms ease;
  }

  .bar-column span {
    color: #4b5563;
    font-size: 13px;
    font-weight: 900;
  }

  .word-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .word-cloud {
    min-height: 230px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 26px;
    border-radius: 24px;
    background:
      linear-gradient(135deg, rgba(252, 231, 243, 0.72), rgba(255, 255, 255, 0.9)),
      #fff7fb;
    border: 1px solid var(--border);
  }

  .cloud-word {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 8px 14px;
    border: 1px solid;
    border-radius: 999px;
    font-weight: 900;
    line-height: 1;
    cursor: pointer;
    user-select: none;
    transition: transform 170ms ease, box-shadow 170ms ease, background 170ms ease;
  }

  .cloud-word:hover {
    transform: translateY(-3px) scale(1.04);
  }

  .cloud-word.selected {
    transform: translateY(-2px) scale(1.05);
  }

  .word-results {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  .word-result-header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .selected-word {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 8px 14px;
    border-radius: 999px;
    color: var(--primary-dark);
    background: var(--accent);
    border: 1px solid var(--border);
    font-weight: 900;
  }

  .word-count {
    color: var(--muted);
    font-size: 14px;
    font-weight: 800;
  }

  .loading-box {
    padding: 20px;
    text-align: center;
    color: var(--muted);
    font-weight: 800;
  }

  .word-result-list {
    display: grid;
    gap: 12px;
    max-height: 350px;
    overflow-y: auto;
    padding-right: 4px;
  }

  mark {
    background: #fce7f3;
    color: #be185d;
    border-radius: 7px;
    padding: 2px 5px;
    font-weight: 900;
  }

  .fade-in {
    animation: fadeIn 280ms ease both;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 980px) {
    .dashboard-shell {
      padding: 18px;
    }

    .hero-content {
      flex-direction: column;
    }

    .stats-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .dashboard-grid {
      grid-template-columns: 1fr;
    }

    .analyze-card,
    .history-card {
      min-height: auto;
    }
  }

  @media (max-width: 640px) {
    .dashboard-shell {
      padding: 12px;
    }

    .hero,
    .card {
      border-radius: 22px;
      padding: 18px;
    }

    .hero h1 {
      font-size: 34px;
    }

    .stats-strip,
    .result-grid,
    .filter-grid {
      grid-template-columns: 1fr;
    }

    .card-header,
    .result-header,
    .pie-area {
      flex-direction: column;
      align-items: stretch;
    }

    .button-export,
    .button-primary {
      width: 100%;
    }

    .button-row {
      flex-direction: column;
    }

    .pie-area {
      gap: 18px;
    }

    .pie-chart {
      align-self: center;
    }

    .bar-chart {
      gap: 12px;
    }

    .word-cloud {
      padding: 18px;
      justify-content: flex-start;
    }
  }
`;

export default App;
