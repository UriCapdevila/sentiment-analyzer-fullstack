import { ReviewInput } from './types';
import { ValidationError } from './errors';

const DEFAULT_MAX_TEXT_LENGTH = 5000;

export function validateReviewInput(body: unknown, env: Env): ReviewInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('body_invalid', 'El cuerpo de la solicitud es obligatorio.');
  }

  const candidate = body as Record<string, unknown>;
  const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
  const maxTextLength = Number(env.MAX_TEXT_LENGTH || DEFAULT_MAX_TEXT_LENGTH);

  if (!text) {
    throw new ValidationError('text_required', 'El texto es obligatorio.');
  }

  if (text.length > maxTextLength) {
    throw new ValidationError('text_too_long', `El texto no puede superar ${maxTextLength} caracteres.`);
  }

  return {
    text,
    channel: optionalString(candidate.channel),
    customerRef: optionalString(candidate.customerRef),
    productArea: optionalString(candidate.productArea),
  };
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 120) : undefined;
}
