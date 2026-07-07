CREATE TABLE IF NOT EXISTS feedback_reviews (
  id TEXT PRIMARY KEY,
  original_text TEXT NOT NULL,
  channel TEXT,
  customer_ref TEXT,
  product_area TEXT,
  score REAL NOT NULL,
  subjectivity REAL NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('Positivo', 'Negativo', 'Neutro', 'Mixto')),
  confidence REAL NOT NULL,
  tone TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  churn_risk TEXT NOT NULL CHECK (churn_risk IN ('low', 'medium', 'high')),
  impact_score INTEGER NOT NULL CHECK (impact_score BETWEEN 0 AND 100),
  summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  source TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS feedback_topics (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  topic_type TEXT NOT NULL CHECK (topic_type IN ('keyword', 'category')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (review_id) REFERENCES feedback_reviews(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_reviews_created_at ON feedback_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_reviews_label ON feedback_reviews(label);
CREATE INDEX IF NOT EXISTS idx_feedback_reviews_severity ON feedback_reviews(severity);
CREATE INDEX IF NOT EXISTS idx_feedback_reviews_churn_risk ON feedback_reviews(churn_risk);
CREATE INDEX IF NOT EXISTS idx_feedback_topics_topic ON feedback_topics(topic);
CREATE INDEX IF NOT EXISTS idx_feedback_topics_review_id ON feedback_topics(review_id);
