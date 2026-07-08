import { validateReviewInput } from '../domain/validation';
import { analyzeWithGemini } from '../infrastructure/gemini';
import {
  countReviewsSince,
  deleteReviewById,
  insertReview,
  selectInsights,
  selectReviews,
  toReviewResponse,
} from '../repositories/feedback-repository';
import { WorkspaceSession } from '../domain/types';
import { DependencyError, NotFoundError, ValidationError } from '../domain/errors';
import { insertUsageEvent, selectUsageSummary } from '../repositories/usage-repository';

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
  const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const { analysis, model, latencyMs, usage } = await analyzeWithGemini(input.text, env, requestId);
    const record = await insertReview(env.DB, {
      id: crypto.randomUUID(),
      workspaceId: workspace.workspaceId,
      input,
      analysis,
      model,
      latencyMs,
    });

    await insertUsageEvent(env.DB, {
      id: crypto.randomUUID(),
      workspaceId: workspace.workspaceId,
      requestId,
      route: 'private_review',
      status: 'success',
      provider: 'gemini',
      model,
      channel: input.channel || null,
      productArea: input.productArea || null,
      textLength: input.text.length,
      providerStatus: 200,
      latencyMs,
      usage,
      reviewId: record.id,
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
  } catch (error) {
    await insertUsageEvent(env.DB, {
      id: crypto.randomUUID(),
      workspaceId: workspace.workspaceId,
      requestId,
      route: 'private_review',
      status: 'error',
      provider: 'gemini',
      model: extractErrorModel(error, modelName),
      channel: input.channel || null,
      productArea: input.productArea || null,
      textLength: input.text.length,
      providerStatus: error instanceof DependencyError ? error.statusCode || null : null,
      latencyMs: extractErrorLatency(error),
      errorCode: error instanceof DependencyError ? error.code : 'analysis_failed',
      errorMessage: error instanceof Error ? error.message : 'No pudimos analizar el feedback.',
    });

    throw error;
  }
}

export async function analyzeDemoReview(body: unknown, env: Env, requestId: string): Promise<unknown> {
  const input = validateReviewInput(body, env);
  const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const { analysis, model, latencyMs, usage } = await analyzeWithGemini(input.text, env, requestId);
    const createdAt = new Date().toISOString();

    await insertUsageEvent(env.DB, {
      id: crypto.randomUUID(),
      workspaceId: null,
      requestId,
      route: 'demo_review',
      status: 'success',
      provider: 'gemini',
      model,
      channel: input.channel || null,
      productArea: input.productArea || null,
      textLength: input.text.length,
      providerStatus: 200,
      latencyMs,
      usage,
    });

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
  } catch (error) {
    await insertUsageEvent(env.DB, {
      id: crypto.randomUUID(),
      workspaceId: null,
      requestId,
      route: 'demo_review',
      status: 'error',
      provider: 'gemini',
      model: extractErrorModel(error, modelName),
      channel: input.channel || null,
      productArea: input.productArea || null,
      textLength: input.text.length,
      providerStatus: error instanceof DependencyError ? error.statusCode || null : null,
      latencyMs: extractErrorLatency(error),
      errorCode: error instanceof DependencyError ? error.code : 'analysis_failed',
      errorMessage: error instanceof Error ? error.message : 'No pudimos analizar el feedback.',
    });

    throw error;
  }
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

export async function deleteReview(
  reviewId: string,
  env: Env,
  workspace: WorkspaceSession,
): Promise<unknown> {
  if (!reviewId || reviewId.length > 120) {
    throw new NotFoundError('review_not_found', 'No encontramos ese feedback en el workspace.');
  }

  const deleted = await deleteReviewById(env.DB, workspace.workspaceId, reviewId);

  if (!deleted) {
    throw new NotFoundError('review_not_found', 'No encontramos ese feedback en el workspace.');
  }

  return {
    deleted: true,
    id: reviewId,
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

export async function getUsageMetrics(
  searchParams: URLSearchParams,
  env: Env,
  workspace: WorkspaceSession,
): Promise<unknown> {
  const days = clampInteger(Number(searchParams.get('days') || 7), 1, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const usage = await selectUsageSummary(env.DB, workspace.workspaceId, since);
  const total = usage.totals.total;

  return {
    window: {
      days,
      since,
    },
    totals: {
      total,
      successful: usage.totals.successful,
      failed: usage.totals.failed,
      rateLimited: usage.totals.rate_limited,
      successRate: total > 0 ? Math.round((usage.totals.successful / total) * 100) : 0,
      avgLatencyMs: usage.totals.avg_latency_ms,
      totalTokens: usage.totals.total_tokens,
      promptTokens: usage.totals.prompt_tokens,
      completionTokens: usage.totals.completion_tokens,
    },
    byRoute: usage.byRoute,
    byStatus: usage.byStatus,
    byProviderStatus: usage.byProviderStatus,
    recentErrors: usage.recentErrors.map((event) => ({
      id: event.id,
      route: event.route,
      providerStatus: event.provider_status,
      errorCode: event.error_code,
      errorMessage: event.error_message,
      createdAt: event.created_at,
    })),
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

function extractErrorLatency(error: unknown): number | null {
  if (!(error instanceof DependencyError)) {
    return null;
  }

  const latencyMs = Number(error.metadata.latencyMs);

  return Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : null;
}

function extractErrorModel(error: unknown, fallbackModel: string): string {
  if (!(error instanceof DependencyError)) {
    return fallbackModel;
  }

  return typeof error.metadata.model === 'string' ? error.metadata.model : fallbackModel;
}
