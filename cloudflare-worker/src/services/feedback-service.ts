import { validateReviewInput } from '../domain/validation';
import { analyzeWithGemini } from '../infrastructure/gemini';
import { insertReview, selectInsights, selectReviews, toReviewResponse } from '../repositories/feedback-repository';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function analyzeAndStoreReview(
  body: unknown,
  env: Env,
  ctx: ExecutionContext,
  requestId: string,
): Promise<unknown> {
  const input = validateReviewInput(body, env);
  const { analysis, model, latencyMs } = await analyzeWithGemini(input.text, env, requestId);
  const record = await insertReview(env.DB, {
    id: crypto.randomUUID(),
    input,
    analysis,
    model,
    latencyMs,
  });

  ctx.waitUntil(
    Promise.resolve(
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'review_saved',
          requestId,
          reviewId: record.id,
          textLength: input.text.length,
          label: analysis.label,
          severity: analysis.severity,
          churnRisk: analysis.churn_risk,
        }),
      ),
    ),
  );

  return toReviewResponse(record);
}

export async function listReviews(searchParams: URLSearchParams, env: Env): Promise<unknown> {
  const limit = clampInteger(Number(searchParams.get('limit') || DEFAULT_LIMIT), 1, MAX_LIMIT);
  const offset = clampInteger(Number(searchParams.get('offset') || 0), 0, 10_000);
  const reviews = await selectReviews(env.DB, { limit, offset });

  return {
    data: reviews.map(toReviewResponse),
    paging: {
      limit,
      offset,
      nextOffset: reviews.length === limit ? offset + limit : null,
    },
  };
}

export async function getInsights(searchParams: URLSearchParams, env: Env): Promise<unknown> {
  const days = clampInteger(Number(searchParams.get('days') || 30), 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const insights = await selectInsights(env.DB, since);
  const totals = insights.totals;
  const total = Number(totals.total || 0);

  return {
    window: {
      days,
      since,
    },
    totals: {
      total,
      negative: Number(totals.negative || 0),
      mixed: Number(totals.mixed || 0),
      highSeverity: Number(totals.high_severity || 0),
      highChurnRisk: Number(totals.high_churn_risk || 0),
      avgImpactScore: Math.round(Number(totals.avg_impact_score || 0)),
      riskRate: total > 0 ? Math.round((Number(totals.high_churn_risk || 0) / total) * 100) : 0,
    },
    topTopics: insights.topics,
    recent: insights.recent.map(toReviewResponse),
  };
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}
