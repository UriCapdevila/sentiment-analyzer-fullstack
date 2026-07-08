import { ReviewInput, ReviewRecord, ReviewResponse, SentimentAnalysis } from '../domain/types';

type StoredReviewInput = {
  id: string;
  workspaceId: string;
  input: ReviewInput;
  analysis: SentimentAnalysis;
  model: string;
  latencyMs: number;
};

type ListReviewsOptions = {
  workspaceId: string;
  limit: number;
  offset: number;
};

export async function insertReview(db: D1Database, review: StoredReviewInput): Promise<ReviewRecord> {
  const createdAt = new Date().toISOString();
  const keywordsJson = JSON.stringify(review.analysis.keywords);
  const categoriesJson = JSON.stringify(review.analysis.categories);
  const statements = [
    db
      .prepare(
        `INSERT INTO feedback_reviews (
          id,
          workspace_id,
          original_text,
          channel,
          customer_ref,
          product_area,
          score,
          subjectivity,
          label,
          confidence,
          tone,
          severity,
          churn_risk,
          impact_score,
          summary,
          recommended_action,
          keywords_json,
          categories_json,
          source,
          model,
          provider_latency_ms,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        review.id,
        review.workspaceId,
        review.input.text,
        review.input.channel || null,
        review.input.customerRef || null,
        review.input.productArea || null,
        review.analysis.score,
        review.analysis.subjectivity,
        review.analysis.label,
        review.analysis.confidence,
        review.analysis.tone,
        review.analysis.severity,
        review.analysis.churn_risk,
        review.analysis.impact_score,
        review.analysis.summary,
        review.analysis.recommended_action,
        keywordsJson,
        categoriesJson,
        review.analysis.source,
        review.model,
        review.latencyMs,
        createdAt,
      ),
    ...topicStatements(db, review.id, review.analysis.keywords, 'keyword'),
    ...topicStatements(db, review.id, review.analysis.categories, 'category'),
  ];

  await db.batch(statements);

  return {
    id: review.id,
    workspace_id: review.workspaceId,
    original_text: review.input.text,
    channel: review.input.channel || null,
    customer_ref: review.input.customerRef || null,
    product_area: review.input.productArea || null,
    score: review.analysis.score,
    subjectivity: review.analysis.subjectivity,
    label: review.analysis.label,
    confidence: review.analysis.confidence,
    tone: review.analysis.tone,
    severity: review.analysis.severity,
    churn_risk: review.analysis.churn_risk,
    impact_score: review.analysis.impact_score,
    summary: review.analysis.summary,
    recommended_action: review.analysis.recommended_action,
    keywords_json: keywordsJson,
    categories_json: categoriesJson,
    source: review.analysis.source,
    model: review.model,
    provider_latency_ms: review.latencyMs,
    created_at: createdAt,
  };
}

export async function selectReviews(db: D1Database, options: ListReviewsOptions): Promise<ReviewRecord[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM feedback_reviews
       WHERE workspace_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(options.workspaceId, options.limit, options.offset)
    .all<ReviewRecord>();

  return result.results || [];
}

export async function deleteReviewById(db: D1Database, workspaceId: string, reviewId: string): Promise<boolean> {
  const existingReview = await db
    .prepare(
      `SELECT id
       FROM feedback_reviews
       WHERE id = ? AND workspace_id = ?`,
    )
    .bind(reviewId, workspaceId)
    .first<{ id: string }>();

  if (!existingReview) {
    return false;
  }

  await db.batch([
    db
      .prepare('UPDATE usage_events SET review_id = NULL WHERE review_id = ?')
      .bind(reviewId),
    db
      .prepare('DELETE FROM feedback_topics WHERE review_id = ?')
      .bind(reviewId),
    db
      .prepare('DELETE FROM feedback_reviews WHERE id = ? AND workspace_id = ?')
      .bind(reviewId, workspaceId),
  ]);

  return true;
}

export async function countReviewsSince(db: D1Database, workspaceId: string, sinceIso: string): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM feedback_reviews
       WHERE workspace_id = ? AND created_at >= ?`,
    )
    .bind(workspaceId, sinceIso)
    .first<{ total: number }>();

  return Number(result?.total || 0);
}

export async function selectInsights(db: D1Database, workspaceId: string, sinceIso: string): Promise<{
  totals: Record<string, number>;
  topics: Array<{ topic: string; topic_type: string; count: number }>;
  recent: ReviewRecord[];
}> {
  const [totals, topics, recent] = await Promise.all([
    db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN label = 'Negativo' THEN 1 ELSE 0 END) AS negative,
          SUM(CASE WHEN label = 'Mixto' THEN 1 ELSE 0 END) AS mixed,
          SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high_severity,
          SUM(CASE WHEN churn_risk = 'high' THEN 1 ELSE 0 END) AS high_churn_risk,
          AVG(impact_score) AS avg_impact_score
        FROM feedback_reviews
        WHERE workspace_id = ? AND created_at >= ?`,
      )
      .bind(workspaceId, sinceIso)
      .first<Record<string, number>>(),
    db
      .prepare(
        `SELECT ft.topic, ft.topic_type, COUNT(*) AS count
         FROM feedback_topics ft
         INNER JOIN feedback_reviews fr ON fr.id = ft.review_id
         WHERE fr.workspace_id = ? AND ft.created_at >= ?
         GROUP BY ft.topic, ft.topic_type
         ORDER BY count DESC, topic ASC
         LIMIT 10`,
      )
      .bind(workspaceId, sinceIso)
      .all<{ topic: string; topic_type: string; count: number }>(),
    db
      .prepare(
        `SELECT *
         FROM feedback_reviews
         WHERE workspace_id = ? AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT 5`,
      )
      .bind(workspaceId, sinceIso)
      .all<ReviewRecord>(),
  ]);

  return {
    totals: totals || {},
    topics: topics.results || [],
    recent: recent.results || [],
  };
}

export function toReviewResponse(record: ReviewRecord): ReviewResponse {
  return {
    id: record.id,
    workspace_id: record.workspace_id,
    original_text: record.original_text,
    channel: record.channel,
    customer_ref: record.customer_ref,
    product_area: record.product_area,
    created_at: record.created_at,
    analysis: {
      score: record.score,
      subjectivity: record.subjectivity,
      label: record.label,
      keywords: parseStringArray(record.keywords_json),
      confidence: record.confidence,
      tone: record.tone,
      severity: record.severity,
      summary: record.summary,
      recommended_action: record.recommended_action,
      source: 'gemini',
      categories: parseStringArray(record.categories_json),
      churn_risk: record.churn_risk,
      impact_score: record.impact_score,
    },
  };
}

function topicStatements(
  db: D1Database,
  reviewId: string,
  topics: string[],
  topicType: 'keyword' | 'category',
): D1PreparedStatement[] {
  return topics.map((topic) =>
    db
      .prepare('INSERT INTO feedback_topics (id, review_id, topic, topic_type) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), reviewId, normalizeTopic(topic), topicType),
  );
}

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().slice(0, 80);
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}
