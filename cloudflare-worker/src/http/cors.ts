export function createCorsHeaders(request: Request, env: Env): Headers {
  const requestOrigin = request.headers.get('origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || '*';

  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,x-request-id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}

export function handleOptions(headers: Headers): Response {
  return new Response(null, {
    status: 204,
    headers,
  });
}
