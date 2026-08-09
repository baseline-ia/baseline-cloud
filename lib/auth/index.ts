import bcrypt from 'bcrypt';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { nanoid } from 'nanoid';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, tokens, sessions, auditLog } from '@/lib/db/schema';
import { config } from '@/lib/config';

const TOKEN_PREFIX_BYTES = 4;
const TOKEN_SECRET_BYTES = 32;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h
const BCRYPT_ROUNDS = 12;

// ============================================================================
// Passwords
// ============================================================================

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ============================================================================
// Bearer tokens (CLI auth)
// ============================================================================

// Token format: <4-byte-prefix>.<32-byte-secret> (base64url)
// At rest we store only the HMAC-SHA256(token_pepper, raw_token) as token_hash.
// The prefix is stored separately for identification in the dashboard.

export interface IssuedToken {
  id: string;
  raw: string;
  prefix: string;
  name: string;
  userId: string;
  username: string;
}

export async function issueToken(opts: {
  userId: string;
  username: string;
  name?: string;
  ip?: string;
}): Promise<IssuedToken> {
  const id = nanoid(21);
  const prefixBytes = randomBytes(TOKEN_PREFIX_BYTES);
  const secretBytes = randomBytes(TOKEN_SECRET_BYTES);
  const prefix = prefixBytes.toString('base64url');
  const secret = secretBytes.toString('base64url');
  const raw = `${prefix}.${secret}`;
  const tokenHash = hashToken(raw);
  const name = opts.name ?? 'CLI';

  await db.insert(tokens).values({
    id,
    userId: opts.userId,
    tokenPrefix: prefix,
    tokenHash,
    name,
  });

  await writeAudit({
    actorUserId: opts.userId,
    actorUsername: opts.username,
    action: 'token.issue',
    targetUserId: opts.userId,
    targetUsername: opts.username,
    metadata: { tokenId: id, name, prefix },
    ip: opts.ip,
  });

  return { id, raw, prefix, name, userId: opts.userId, username: opts.username };
}

export function hashToken(raw: string): string {
  return createHmac('sha256', config.TOKEN_PEPPER).update(`baseline-cloud-token:v1:${raw}`).digest('hex');
}

export interface ResolvedToken {
  tokenId: string;
  userId: string;
  username: string;
  role: 'admin' | 'member';
  prefix: string;
  name: string;
}

export async function resolveBearerToken(raw: string): Promise<ResolvedToken | null> {
  const dot = raw.indexOf('.');
  if (dot < 0) return null;
  const tokenHash = hashToken(raw);
  const now = Date.now();

  const rows = await db
    .select({
      token: tokens,
      user: users,
    })
    .from(tokens)
    .innerJoin(users, eq(tokens.userId, users.id))
    .where(and(eq(tokens.tokenHash, tokenHash), isNull(tokens.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.user.enabled) return null;

  // Best-effort last-used-at update (fire-and-forget).
  void db
    .update(tokens)
    .set({ lastUsedAt: new Date(now) })
    .where(eq(tokens.id, row.token.id))
    .execute()
    .catch(() => {});

  return {
    tokenId: row.token.id,
    userId: row.user.id,
    username: row.user.username,
    role: row.user.role,
    prefix: row.token.tokenPrefix,
    name: row.token.name,
  };
}

export async function revokeToken(opts: { tokenId: string; byUserId: string; reason?: string }) {
  await db
    .update(tokens)
    .set({
      revokedAt: new Date(),
      revokedByUserId: opts.byUserId,
      revocationReason: opts.reason ?? null,
    })
    .where(eq(tokens.id, opts.tokenId));

  const t = await db.select().from(tokens).where(eq(tokens.id, opts.tokenId)).limit(1);
  const tok = t[0];
  if (tok) {
    await writeAudit({
      actorUserId: opts.byUserId,
      action: 'token.revoke',
      targetUserId: tok.userId,
      targetUsername: undefined,
      metadata: { tokenId: opts.tokenId, reason: opts.reason },
    });
  }
}

// ============================================================================
// Dashboard session cookies (HS256 JWT, stored server-side too)
// ============================================================================

export interface DashboardSession {
  id: string;
  userId: string;
  username: string;
  role: 'admin' | 'member';
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  ip?: string,
): Promise<{ session: DashboardSession; cookieValue: string }> {
  const id = nanoid(32);
  const sessionSecret = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const sessionHash = createHash('sha256').update(sessionSecret).digest('hex');

  await db.insert(sessions).values({
    id,
    userId,
    sessionHash,
    expiresAt,
  });

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new Error('User not found');

  const cookieValue = signCookieValue({ id, userId, sessionSecret, expiresAt: expiresAt.getTime() });

  await writeAudit({
    actorUserId: userId,
    actorUsername: user.username,
    action: 'session.create',
    targetUserId: userId,
    targetUsername: user.username,
    metadata: { sessionId: id },
    ip,
  });

  return {
    session: { id, userId, username: user.username, role: user.role, expiresAt },
    cookieValue,
  };
}

interface CookiePayload {
  id: string;
  userId: string;
  sessionSecret: string;
  expiresAt: number;
}

function signCookieValue(payload: CookiePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', config.JWT_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyCookieValue(value: string): CookiePayload | null {
  const dot = value.indexOf('.');
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac('sha256', config.JWT_SECRET).update(body).digest('base64url');
  // timing-safe
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CookiePayload;
    if (
      typeof payload.id !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.sessionSecret !== 'string' ||
      typeof payload.expiresAt !== 'number'
    ) {
      return null;
    }
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function resolveSession(cookieValue: string | undefined): Promise<DashboardSession | null> {
  if (!cookieValue) return null;
  const payload = verifyCookieValue(cookieValue);
  if (!payload) return null;

  const sessionHash = createHash('sha256').update(payload.sessionSecret).digest('hex');
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, payload.id),
        eq(sessions.sessionHash, sessionHash),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.user.enabled) return null;

  return {
    id: row.session.id,
    userId: row.user.id,
    username: row.user.username,
    role: row.user.role,
    expiresAt: row.session.expiresAt,
  };
}

export async function destroySession(sessionId: string, actorUserId?: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  if (actorUserId) {
    await writeAudit({
      actorUserId,
      action: 'session.destroy',
      metadata: { sessionId },
    });
  }
}

// ============================================================================
// Audit log
// ============================================================================

export async function writeAudit(opts: {
  actorUserId?: string | null;
  actorUsername?: string | null;
  action: string;
  targetUserId?: string | null;
  targetUsername?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await db.insert(auditLog).values({
    id: nanoid(21),
    actorUserId: opts.actorUserId ?? null,
    actorUsername: opts.actorUsername ?? null,
    action: opts.action,
    targetUserId: opts.targetUserId ?? null,
    targetUsername: opts.targetUsername ?? null,
    metadata: opts.metadata ?? null,
    ip: opts.ip ?? null,
  });
}
