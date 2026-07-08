import { AuthError, ValidationError } from '../domain/errors';
import { WorkspaceSession } from '../domain/types';

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type StoredUser = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  status: string;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  email: string;
  user_name: string;
  user_status: string;
  workspace_id: string;
  workspace_name: string;
  plan: WorkspaceSession['plan'];
  workspace_status: WorkspaceSession['status'];
  monthly_analysis_limit: number;
  role: string;
};

const SESSION_DAYS = 7;
const PASSWORD_SCHEME = 'pbkdf2_sha256';
const SIMPLE_PASSWORD_SCHEME = 'sha256_salted';

export async function loginWithPassword(body: unknown, env: Env): Promise<unknown> {
  const credentials = parseLoginBody(body);
  const user = await findUserByEmail(env.DB, credentials.email);

  if (!user || user.status !== 'active') {
    throw new AuthError('invalid_credentials', 'Email o contrasena incorrectos.');
  }

  const passwordOk = await verifyPassword(credentials.password, user.password_hash);

  if (!passwordOk) {
    throw new AuthError('invalid_credentials', 'Email o contrasena incorrectos.');
  }

  const workspace = await findPrimaryWorkspaceForUser(env.DB, user.id);

  if (!workspace) {
    throw new AuthError('workspace_missing', 'El usuario no tiene un workspace activo.');
  }

  const token = createSessionToken();
  const tokenHash = await sha256Hex(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.batch([
    env.DB
      .prepare(
        `INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(sessionId, user.id, tokenHash, expiresAt),
    env.DB
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), user.id),
  ]);

  return {
    token,
    expires_at: expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    workspace,
  };
}

export async function authenticateSession(request: Request, env: Env): Promise<WorkspaceSession> {
  const token = extractBearerToken(request);

  if (!token) {
    throw new AuthError('auth_required', 'Inicia sesion para acceder a este recurso.');
  }

  const tokenHash = await sha256Hex(token);
  const row = await env.DB
    .prepare(
      `SELECT
        s.id AS session_id,
        u.id AS user_id,
        u.email,
        u.name AS user_name,
        u.status AS user_status,
        w.id AS workspace_id,
        w.name AS workspace_name,
        w.plan,
        w.status AS workspace_status,
        w.monthly_analysis_limit,
        wm.role
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       INNER JOIN workspace_members wm ON wm.user_id = u.id
       INNER JOIN workspaces w ON w.id = wm.workspace_id
       WHERE s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > ?
       ORDER BY wm.created_at ASC
       LIMIT 1`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<SessionRow>();

  if (!row || row.user_status !== 'active') {
    throw new AuthError('auth_invalid', 'La sesion no es valida o expiro.');
  }

  if (row.workspace_status !== 'active') {
    throw new AuthError('forbidden', 'El workspace no esta activo.');
  }

  return {
    workspaceId: row.workspace_id,
    name: row.workspace_name,
    plan: row.plan,
    status: row.workspace_status,
    monthlyAnalysisLimit: Number(row.monthly_analysis_limit || 0),
  };
}

export async function logoutSession(request: Request, env: Env): Promise<unknown> {
  const token = extractBearerToken(request);

  if (!token) {
    return { ok: true };
  }

  const tokenHash = await sha256Hex(token);
  await env.DB
    .prepare('UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(new Date().toISOString(), tokenHash)
    .run();

  return { ok: true };
}

export function serializeWorkspace(workspace: WorkspaceSession): unknown {
  return {
    id: workspace.workspaceId,
    name: workspace.name,
    plan: workspace.plan,
    status: workspace.status,
    monthlyAnalysisLimit: workspace.monthlyAnalysisLimit,
  };
}

function parseLoginBody(body: unknown): { email: string; password: string } {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('body_invalid', 'El cuerpo de la solicitud es obligatorio.');
  }

  const candidate = body as LoginBody;
  const email = typeof candidate.email === 'string' ? candidate.email.trim().toLowerCase() : '';
  const password = typeof candidate.password === 'string' ? candidate.password : '';

  if (!email || !email.includes('@')) {
    throw new ValidationError('email_invalid', 'Ingresa un email valido.');
  }

  if (!password) {
    throw new ValidationError('password_required', 'La contrasena es obligatoria.');
  }

  return { email, password };
}

async function findUserByEmail(db: D1Database, email: string): Promise<StoredUser | null> {
  return await db
    .prepare('SELECT * FROM users WHERE email = ? LIMIT 1')
    .bind(email)
    .first<StoredUser>();
}

async function findPrimaryWorkspaceForUser(db: D1Database, userId: string): Promise<WorkspaceSession | null> {
  const row = await db
    .prepare(
      `SELECT
        w.id AS workspace_id,
        w.name AS workspace_name,
        w.plan,
        w.status AS workspace_status,
        w.monthly_analysis_limit
       FROM workspace_members wm
       INNER JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.user_id = ?
       ORDER BY wm.created_at ASC
       LIMIT 1`,
    )
    .bind(userId)
    .first<SessionRow>();

  if (!row || row.workspace_status !== 'active') {
    return null;
  }

  return {
    workspaceId: row.workspace_id,
    name: row.workspace_name,
    plan: row.plan,
    status: row.workspace_status,
    monthlyAnalysisLimit: Number(row.monthly_analysis_limit || 0),
  };
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, iterationsText, saltBase64, hashBase64] = storedHash.split('$');

  if (scheme === SIMPLE_PASSWORD_SCHEME) {
    const [, saltHex, hashHex] = storedHash.split('$');
    const actualHash = await sha256Hex(`${saltHex}:${password}`);
    return timingSafeStringEqual(actualHash, hashHex || '');
  }

  if (scheme !== PASSWORD_SCHEME || !iterationsText || !saltBase64 || !hashBase64) {
    return false;
  }

  const iterations = Number(iterationsText);
  const salt = base64ToBytes(saltBase64);
  const expectedHash = base64ToBytes(hashBase64);
  const actualHash = await derivePasswordHash(password, salt, iterations);

  return timingSafeEqual(actualHash, expectedHash);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const encodedPassword = new TextEncoder().encode(password);
  const passwordBuffer = encodedPassword.buffer.slice(
    encodedPassword.byteOffset,
    encodedPassword.byteOffset + encodedPassword.byteLength,
  ) as ArrayBuffer;
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBuffer,
      iterations,
    },
    passwordKey,
    256,
  );

  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index];
  }

  return diff === 0;
}

function extractBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authorization.slice(7).trim();
}

function createSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `ips_${bytesToHex(bytes)}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function base64ToBytes(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleanValue = value.replace(/=+$/g, '');
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of cleanValue) {
    const index = alphabet.indexOf(char);

    if (index === -1) {
      continue;
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(output);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
