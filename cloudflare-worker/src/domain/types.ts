export type SentimentLabel = 'Positivo' | 'Negativo' | 'Neutro' | 'Mixto';
export type Severity = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';

export type ReviewInput = {
  text: string;
  channel?: string;
  customerRef?: string;
  productArea?: string;
};

export type WorkspaceSession = {
  workspaceId: string;
  name: string;
  plan: 'solo' | 'growth' | 'scale';
  status: 'active' | 'paused' | 'cancelled';
  monthlyAnalysisLimit: number;
};

export type SentimentAnalysis = {
  score: number;
  subjectivity: number;
  label: SentimentLabel;
  keywords: string[];
  confidence: number;
  tone: string;
  severity: Severity;
  summary: string;
  recommended_action: string;
  source: 'gemini';
  categories: string[];
  churn_risk: RiskLevel;
  impact_score: number;
};

export type ReviewRecord = {
  id: string;
  workspace_id: string | null;
  original_text: string;
  channel: string | null;
  customer_ref: string | null;
  product_area: string | null;
  score: number;
  subjectivity: number;
  label: SentimentLabel;
  confidence: number;
  tone: string;
  severity: Severity;
  churn_risk: RiskLevel;
  impact_score: number;
  summary: string;
  recommended_action: string;
  keywords_json: string;
  categories_json: string;
  source: string;
  model: string;
  provider_latency_ms: number;
  created_at: string;
};

export type ReviewResponse = {
  id: string;
  workspace_id?: string | null;
  analysis: SentimentAnalysis;
  original_text: string;
  channel: string | null;
  customer_ref: string | null;
  product_area: string | null;
  created_at: string;
};

export type LlmUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type UsageEventStatus = 'success' | 'error';
export type UsageEventRoute = 'demo_review' | 'private_review';

export type UsageEventInput = {
  id: string;
  workspaceId: string | null;
  requestId: string;
  route: UsageEventRoute;
  status: UsageEventStatus;
  provider: 'gemini';
  model: string;
  channel?: string | null;
  productArea?: string | null;
  textLength: number;
  providerStatus?: number | null;
  latencyMs?: number | null;
  usage?: LlmUsage | null;
  estimatedCostUsd?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  reviewId?: string | null;
};

export type UsageEventRecord = {
  id: string;
  workspace_id: string | null;
  request_id: string;
  route: UsageEventRoute;
  operation: string;
  status: UsageEventStatus;
  provider: string;
  model: string;
  channel: string | null;
  product_area: string | null;
  text_length: number;
  provider_status: number | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  error_code: string | null;
  error_message: string | null;
  review_id: string | null;
  created_at: string;
};
