import { DependencyError, ValidationError } from '../domain/errors';

type JsonResponseOptions = {
  headers: Headers;
  requestId: string;
  status?: number;
};

export function jsonResponse(payload: unknown, options: JsonResponseOptions): Response {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('x-request-id', options.requestId);

  return new Response(JSON.stringify(payload), {
    status: options.status || 200,
    headers,
  });
}

export function notFoundResponse(headers: Headers, requestId: string): Response {
  return jsonResponse(
    {
      error: {
        code: 'not_found',
        message: 'Ruta no encontrada.',
      },
    },
    { headers, requestId, status: 404 },
  );
}

export function errorResponse(error: unknown, headers: Headers, requestId: string): Response {
  if (error instanceof ValidationError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { headers, requestId, status: 422 },
    );
  }

  if (error instanceof DependencyError) {
    console.error(JSON.stringify({ level: 'error', requestId, code: error.code, message: error.message }));
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { headers, requestId, status: 502 },
    );
  }

  console.error(JSON.stringify({ level: 'error', requestId, message: 'unexpected_error' }));
  return jsonResponse(
    {
      error: {
        code: 'internal_error',
        message: 'No pudimos procesar la solicitud.',
      },
    },
    { headers, requestId, status: 500 },
  );
}
