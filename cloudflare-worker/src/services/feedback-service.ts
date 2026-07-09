import { validateReviewInput } from '../domain/validation';
import { analyzeWithGemini } from '../infrastructure/gemini';
import {
  countReviewsSince,
  deleteReviewById,
  insertReview,
  selectInsights,
  selectDuplicateReview,
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
  const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const duplicate = await selectDuplicateReview(env.DB, workspace.workspaceId, input);

  if (duplicate) {
    return {
      ...toReviewResponse(duplicate),
      reused: true,
    };
  }

  try {
    await assertMonthlyLimit(env, workspace);
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
      errorCode: extractErrorCode(error),
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
  const topRiskArea = insights.byArea[0] || null;
  const topTopic = insights.topics[0] || null;

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
    byArea: insights.byArea.map((area) => ({
      label: area.label || 'general',
      total: Number(area.total || 0),
      highChurnRisk: Number(area.high_churn_risk || 0),
      avgImpactScore: Math.round(Number(area.avg_impact_score || 0)),
    })),
    byChannel: insights.byChannel.map((channel) => ({
      label: channel.label || 'manual',
      total: Number(channel.total || 0),
      negative: Number(channel.negative || 0),
      mixed: Number(channel.mixed || 0),
    })),
    bySentiment: insights.bySentiment.map((sentiment) => ({
      label: sentiment.label,
      total: Number(sentiment.total || 0),
      rate: total > 0 ? Math.round((Number(sentiment.total || 0) / total) * 100) : 0,
    })),
    executiveSummary: buildExecutiveSummary({
      total,
      highChurnRisk: Number(totals.high_churn_risk || 0),
      highSeverity: Number(totals.high_severity || 0),
      riskRate: total > 0 ? Math.round((Number(totals.high_churn_risk || 0) / total) * 100) : 0,
      topRiskArea: topRiskArea?.label || null,
      topTopic: topTopic?.topic || null,
    }),
    priority: insights.priority.map(toReviewResponse),
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

function extractErrorCode(error: unknown): string {
  if (error instanceof DependencyError || error instanceof ValidationError) {
    return error.code;
  }

  return 'analysis_failed';
}

function buildExecutiveSummary(input: {
  total: number;
  highChurnRisk: number;
  highSeverity: number;
  riskRate: number;
  topRiskArea: string | null;
  topTopic: string | null;
}): string {
  if (!input.total) {
    return 'Todavia no hay feedback suficiente para construir una lectura ejecutiva del periodo.';
  }

  const focus = input.topRiskArea ? ` El area que pide mas atencion es ${input.topRiskArea}.` : '';
  const topic = input.topTopic ? ` El tema mas repetido es ${input.topTopic}.` : '';

  return `Se analizaron ${input.total} opiniones en la ventana seleccionada. Hay ${input.highChurnRisk} senales de churn alto y ${input.highSeverity} casos de severidad alta, con una tasa de riesgo del ${input.riskRate}%.${focus}${topic}`;
}
