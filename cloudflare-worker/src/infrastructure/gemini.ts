import { DependencyError } from '../domain/errors';
import { SentimentAnalysis } from '../domain/types';

type GeminiResult = {
  analysis: SentimentAnalysis;
  model: string;
  latencyMs: number;
};

const SYSTEM_INSTRUCTION = [
  'You are a customer-feedback intelligence engine for a SaaS product.',
  'Classify customer feedback with business judgment, not generic positivity.',
  'Strongly weight churn risk, cancellation, refunds, billing, support delays, bugs, UX friction, pricing complaints, reliability, and checkout failures.',
  'Use Mixto when feedback contains both clear praise and clear friction.',
  'Return concise Spanish business-facing fields.',
].join(' ');

export async function analyzeWithGemini(text: string, env: Env, requestId: string): Promise<GeminiResult> {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const timeoutMs = Number(env.LLM_TIMEOUT_MS || '25000');
  const url = buildGatewayUrl(env, model);
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(env, requestId),
    body: JSON.stringify(buildGeminiPayload(text)),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((error: unknown) => {
    throw new DependencyError('llm_request_failed', error instanceof Error ? error.message : 'Gemini no respondio.');
  });

  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    const body = await response.text();
    throw new DependencyError('llm_bad_response', `Gemini devolvio HTTP ${response.status}: ${body.slice(0, 240)}`);
  }

  const responseData = await response.json();
  const outputText = extractGeminiText(responseData);
  const analysis = normalizeAnalysis(JSON.parse(outputText));

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'llm_analysis_complete',
      requestId,
      latencyMs,
      model,
      label: analysis.label,
      severity: analysis.severity,
    }),
  );

  return {
    analysis,
    model,
    latencyMs,
  };
}

function buildGatewayUrl(env: Env, model: string): string {
  if (!env.AI_GATEWAY_ACCOUNT_ID || !env.AI_GATEWAY_NAME) {
    throw new DependencyError('gateway_not_configured', 'AI Gateway no esta configurado.');
  }

  return `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/google-ai-studio/v1beta/models/${model}:generateContent`;
}

function buildHeaders(env: Env, requestId: string): Headers {
  if (!env.GEMINI_API_KEY) {
    throw new DependencyError('gemini_key_missing', 'GEMINI_API_KEY no esta configurada.');
  }

  const headers = new Headers({
    'content-type': 'application/json',
    'x-goog-api-key': env.GEMINI_API_KEY,
    'cf-aig-metadata': JSON.stringify({ requestId, product: 'insightpulse' }),
  });

  if (env.CF_AIG_TOKEN) {
    headers.set('cf-aig-authorization', `Bearer ${env.CF_AIG_TOKEN}`);
  }

  return headers;
}

function buildGeminiPayload(text: string): unknown {
  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Analyze this customer feedback and return only valid JSON:\n${text}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: analysisSchema(),
    },
  };
}

function analysisSchema(): unknown {
  return {
    type: 'object',
    properties: {
      score: { type: 'number' },
      subjectivity: { type: 'number' },
      label: { type: 'string', enum: ['Positivo', 'Negativo', 'Neutro', 'Mixto'] },
      keywords: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' },
      tone: { type: 'string' },
      severity: { type: 'string', enum: ['low', 'medium', 'high'] },
      summary: { type: 'string' },
      recommended_action: { type: 'string' },
      categories: { type: 'array', items: { type: 'string' } },
      churn_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
      impact_score: { type: 'number' },
    },
    required: [
      'score',
      'subjectivity',
      'label',
      'keywords',
      'confidence',
      'tone',
      'severity',
      'summary',
      'recommended_action',
      'categories',
      'churn_risk',
      'impact_score',
    ],
  };
}

function extractGeminiText(responseData: unknown): string {
  const candidate = responseData as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = candidate.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;

  if (!text) {
    throw new DependencyError('llm_empty_response', 'Gemini no devolvio texto analizable.');
  }

  return text;
}

function normalizeAnalysis(value: unknown): SentimentAnalysis {
  const analysis = value as Record<string, unknown>;

  return {
    score: clampNumber(analysis.score, -1, 1),
    subjectivity: clampNumber(analysis.subjectivity, 0, 1),
    label: normalizeLabel(analysis.label),
    keywords: normalizeList(analysis.keywords, 8),
    confidence: clampNumber(analysis.confidence, 0, 1),
    tone: String(analysis.tone || 'Sin tono detectado.'),
    severity: normalizeSeverity(analysis.severity),
    summary: String(analysis.summary || 'Sin resumen disponible.'),
    recommended_action: String(analysis.recommended_action || 'Revisar manualmente.'),
    source: 'gemini',
    categories: normalizeList(analysis.categories, 6),
    churn_risk: normalizeRisk(analysis.churn_risk),
    impact_score: Math.round(clampNumber(analysis.impact_score, 0, 100)),
  };
}

function clampNumber(value: unknown, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.min(max, Math.max(min, numeric));
}

function normalizeList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit);
}

function normalizeLabel(value: unknown): SentimentAnalysis['label'] {
  return value === 'Positivo' || value === 'Negativo' || value === 'Mixto' ? value : 'Neutro';
}

function normalizeSeverity(value: unknown): SentimentAnalysis['severity'] {
  return value === 'high' || value === 'medium' ? value : 'low';
}

function normalizeRisk(value: unknown): SentimentAnalysis['churn_risk'] {
  return value === 'high' || value === 'medium' ? value : 'low';
}
