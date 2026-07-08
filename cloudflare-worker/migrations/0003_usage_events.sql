CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  request_id TEXT NOT NULL,
  route TEXT NOT NULL CHECK (route IN ('demo_review', 'private_review')),
  operation TEXT NOT NULL DEFAULT 'llm_analysis',
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  provider TEXT NOT NULL DEFAULT 'gemini',
  model TEXT NOT NULL,
  channel TEXT,
  product_area TEXT,
  text_length INTEGER NOT NULL DEFAULT 0,
  provider_status INTEGER,
  latency_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_usd REAL,
  error_code TEXT,
  error_message TEXT,
  review_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (review_id) REFERENCES feedback_reviews(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_workspace_created_at
  ON usage_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_created_at
  ON usage_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_status
  ON usage_events(status);

CREATE INDEX IF NOT EXISTS idx_usage_events_provider_status
  ON usage_events(provider_status);
