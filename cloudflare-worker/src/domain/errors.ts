export class ValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DependencyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
    public readonly metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DependencyError';
  }
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
