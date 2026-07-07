import { analyzeAndStoreReview, getInsights, listReviews } from './services/feedback-service';
import { createCorsHeaders, handleOptions } from './http/cors';
import { errorResponse, jsonResponse, notFoundResponse } from './http/responses';
import { parseJsonBody } from './http/request';
import { ValidationError } from './domain/errors';

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const corsHeaders = createCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptions(corsHeaders);
  }

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(
        {
          status: 'ok',
          service: 'insightpulse-worker',
          gatewayConfigured: isGatewayConfigured(env),
          model: env.GEMINI_MODEL,
        },
        { headers: corsHeaders, requestId },
      );
    }

    if (request.method === 'POST' && url.pathname === '/api/review') {
      const body = await parseJsonBody(request);
      const result = await analyzeAndStoreReview(body, env, ctx, requestId);
      return jsonResponse(result, { headers: corsHeaders, requestId, status: 201 });
    }

    if (request.method === 'GET' && url.pathname === '/api/reviews') {
      const result = await listReviews(url.searchParams, env);
      return jsonResponse(result, { headers: corsHeaders, requestId });
    }

    if (request.method === 'GET' && url.pathname === '/api/insights') {
      const result = await getInsights(url.searchParams, env);
      return jsonResponse(result, { headers: corsHeaders, requestId });
    }

    return notFoundResponse(corsHeaders, requestId);
  } catch (error) {
    return errorResponse(error, corsHeaders, requestId);
  }
}

function isGatewayConfigured(env: Env): boolean {
  return Boolean(env.AI_GATEWAY_ACCOUNT_ID && env.AI_GATEWAY_NAME && env.GEMINI_API_KEY);
}
