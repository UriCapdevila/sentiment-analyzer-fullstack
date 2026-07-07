import { ValidationError } from '../domain/errors';

const MAX_BODY_BYTES = 32_000;

export async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ValidationError('content_type_invalid', 'El cuerpo debe enviarse como application/json.');
  }

  const contentLength = Number(request.headers.get('content-length') || '0');

  if (contentLength > MAX_BODY_BYTES) {
    throw new ValidationError('payload_too_large', 'El cuerpo de la solicitud es demasiado grande.');
  }

  try {
    return await request.json();
  } catch {
    throw new ValidationError('json_invalid', 'El cuerpo JSON no es valido.');
  }
}
