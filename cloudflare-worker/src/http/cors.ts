export function createCorsHeaders(request: Request, env: Env): Headers {
  const requestOrigin = request.headers.get('origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
  const origin = isAllowedOrigin(requestOrigin, allowedOrigins) ? requestOrigin : allowedOrigins[0] || '*';

  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,x-request-id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}

function isAllowedOrigin(requestOrigin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === requestOrigin) {
      return true;
    }

    if (allowedOrigin.includes('*')) {
      const [prefix, suffix] = allowedOrigin.split('*');
      const wildcardValue = requestOrigin.slice(prefix.length, requestOrigin.length - suffix.length);

      return requestOrigin.startsWith(prefix)
        && requestOrigin.endsWith(suffix)
        && wildcardValue.length > 0
        && !wildcardValue.includes('.');
    }

    return false;
  });
}

export function handleOptions(headers: Headers): Response {
  return new Response(null, {
    status: 204,
    headers,
  });
}
