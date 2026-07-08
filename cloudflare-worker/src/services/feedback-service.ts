import { validateReviewInput } from '../domain/validation';
import { analyzeWithGemini } from '../infrastructure/gemini';
import {
  countReviewsSince,
  insertReview,
  selectInsights,
  selectReviews,
  toReviewResponse,
} from '../repositories/feedback-repository';
import { WorkspaceSession } from '../domain/types';
import { ValidationError } from '../domain/errors';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function analyzeAndStoreReview(
  body: unknown,
  env: Env,
  ctx: ExecutionContext,
  requestId: string,
  workspace: WorkspaceSession,
): Promise<unknown> {
  const input = validateReviewInput(body, env);
  await assertMonthlyLimit(env, workspace);
  const { analysis, model, latencyMs } = await analyzeWithGemini(input.text, env, requestId);
  const record = await insertReview(env.DB, {
    id: crypto.randomUUID(),
    workspaceId: workspace.workspaceId,
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
          workspaceId: workspace.workspaceId,
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

export async function analyzeDemoReview(body: unknown, env: Env, requestId: string): Promise<unknown> {
  const input = validateReviewInput(body, env);
  const { analysis, model, latencyMs } = await analyzeWithGemini(input.text, env, requestId);
  const createdAt = new Date().toISOString();

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'demo_review_analyzed',
      requestId,
      textLength: input.text.length,
      label: analysis.label,
      severity: analysis.severity,
      churnRisk: analysis.churn_risk,
      model,
      latencyMs,
    }),
  );

  return {
    id: `demo-${crypto.randomUUID()}`,
    original_text: input.text,
    channel: input.channel || null,
    customer_ref: input.customerRef || null,
    product_area: input.productArea || null,
    created_at: createdAt,
    persisted: false,
    analysis,
  };
}

export async function listReviews(
  searchParams: URLSearchParams,
  env: Env,
  workspace: WorkspaceSession,
): Promise<unknown> {
  const limit = clampInteger(Number(searchParams.get('limit') || DEFAULT_LIMIT), 1, MAX_LIMIT);
  const offset = clampInteger(Number(searchParams.get('offset') || 0), 0, 10_000);
  const reviews = await selectReviews(env.DB, { workspaceId: workspace.workspaceId, limit, offset });

  return {
    data: reviews.map(toReviewResponse),
    paging: {
      limit,
      offset,
      nextOffset: reviews.length === limit ? offset + limit : null,
    },
  };
}

export async function getInsights(
  searchParams: URLSearchParams,
  env: Env,
  workspace: WorkspaceSession,
): Promise<unknown> {
  const days = clampInteger(Number(searchParams.get('days') || 30), 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const insights = await selectInsights(env.DB, workspace.workspaceId, since);
  const totals = insights.totals;
  const total = Number(totals.total || 0);

  return {
    window: {
      days,
      since,
    },
    workspace: {
      id: workspace.workspaceId,
      name: workspace.name,
      plan: workspace.plan,
      monthlyAnalysisLimit: workspace.monthlyAnalysisLimit,
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

async function assertMonthlyLimit(env: Env, workspace: WorkspaceSession): Promise<void> {
  if (!workspace.monthlyAnalysisLimit) {
    return;
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const usage = await countReviewsSince(env.DB, workspace.workspaceId, monthStart);

  if (usage >= workspace.monthlyAnalysisLimit) {
    throw new ValidationError(
      'monthly_limit_reached',
      `El workspace alcanzo el limite mensual de ${workspace.monthlyAnalysisLimit} analisis.`,
    );
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}
