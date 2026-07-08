import { UsageEventInput, UsageEventRecord } from '../domain/types';

type UsageSummary = {
  total: number;
  successful: number;
  failed: number;
  rate_limited: number;
  avg_latency_ms: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
};

type UsageBreakdown = {
  label: string | null;
  total: number;
};

export async function insertUsageEvent(db: D1Database, event: UsageEventInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_events (
        id,
        workspace_id,
        request_id,
        route,
        status,
        provider,
        model,
        channel,
        product_area,
        text_length,
        provider_status,
        latency_ms,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        estimated_cost_usd,
        error_code,
        error_message,
        review_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      event.id,
      event.workspaceId,
      event.requestId,
      event.route,
      event.status,
      event.provider,
      event.model,
      event.channel || null,
      event.productArea || null,
      event.textLength,
      event.providerStatus ?? null,
      event.latencyMs ?? null,
      event.usage?.promptTokens ?? null,
      event.usage?.completionTokens ?? null,
      event.usage?.totalTokens ?? null,
      event.estimatedCostUsd ?? null,
      event.errorCode || null,
      event.errorMessage ? event.errorMessage.slice(0, 500) : null,
      event.reviewId || null,
    )
    .run();
}

export async function selectUsageSummary(
  db: D1Database,
  workspaceId: string,
  sinceIso: string,
): Promise<{
  totals: UsageSummary;
  byRoute: UsageBreakdown[];
  byStatus: UsageBreakdown[];
  byProviderStatus: UsageBreakdown[];
  recentErrors: UsageEventRecord[];
}> {
  const [totals, byRoute, byStatus, byProviderStatus, recentErrors] = await Promise.all([
    db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN provider_status = 429 THEN 1 ELSE 0 END) AS rate_limited,
          AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms ELSE NULL END) AS avg_latency_ms,
          SUM(COALESCE(total_tokens, 0)) AS total_tokens,
          SUM(COALESCE(prompt_tokens, 0)) AS prompt_tokens,
          SUM(COALESCE(completion_tokens, 0)) AS completion_tokens
        FROM usage_events
        WHERE workspace_id = ? AND created_at >= ?`,
      )
      .bind(workspaceId, sinceIso)
      .first<UsageSummary>(),
    db
      .prepare(
        `SELECT route AS label, COUNT(*) AS total
         FROM usage_events
         WHERE workspace_id = ? AND created_at >= ?
         GROUP BY route
         ORDER BY total DESC`,
      )
      .bind(workspaceId, sinceIso)
      .all<UsageBreakdown>(),
    db
      .prepare(
        `SELECT status AS label, COUNT(*) AS total
         FROM usage_events
         WHERE workspace_id = ? AND created_at >= ?
         GROUP BY status
         ORDER BY total DESC`,
      )
      .bind(workspaceId, sinceIso)
      .all<UsageBreakdown>(),
    db
      .prepare(
        `SELECT CAST(provider_status AS TEXT) AS label, COUNT(*) AS total
         FROM usage_events
         WHERE workspace_id = ? AND created_at >= ? AND provider_status IS NOT NULL
         GROUP BY provider_status
         ORDER BY total DESC
         LIMIT 10`,
      )
      .bind(workspaceId, sinceIso)
      .all<UsageBreakdown>(),
    db
      .prepare(
        `SELECT *
         FROM usage_events
         WHERE workspace_id = ? AND created_at >= ? AND status = 'error'
         ORDER BY created_at DESC
         LIMIT 5`,
      )
      .bind(workspaceId, sinceIso)
      .all<UsageEventRecord>(),
  ]);

  return {
    totals: normalizeTotals(totals),
    byRoute: byRoute.results || [],
    byStatus: byStatus.results || [],
    byProviderStatus: byProviderStatus.results || [],
    recentErrors: recentErrors.results || [],
  };
}

function normalizeTotals(totals?: UsageSummary | null): UsageSummary {
  return {
    total: Number(totals?.total || 0),
    successful: Number(totals?.successful || 0),
    failed: Number(totals?.failed || 0),
    rate_limited: Number(totals?.rate_limited || 0),
    avg_latency_ms: Math.round(Number(totals?.avg_latency_ms || 0)),
    total_tokens: Number(totals?.total_tokens || 0),
    prompt_tokens: Number(totals?.prompt_tokens || 0),
    completion_tokens: Number(totals?.completion_tokens || 0),
  };
}
