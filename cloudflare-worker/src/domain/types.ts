export type SentimentLabel = 'Positivo' | 'Negativo' | 'Neutro' | 'Mixto';
export type Severity = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';

export type ReviewInput = {
  text: string;
  channel?: string;
  customerRef?: string;
  productArea?: string;
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
  analysis: SentimentAnalysis;
  original_text: string;
  channel: string | null;
  customer_ref: string | null;
  product_area: string | null;
  created_at: string;
};
