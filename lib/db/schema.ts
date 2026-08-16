import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ============================================================================
// Users
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => ({
    usernameIdx: uniqueIndex('users_username_idx').on(t.username),
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ============================================================================
// Tokens (bearer, used by the CLI)
// ============================================================================

export const tokens = pgTable(
  'tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenPrefix: text('token_prefix').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: text('revoked_by_user_id').references(() => users.id),
    revocationReason: text('revocation_reason'),
  },
  (t) => ({
    userIdx: index('tokens_user_idx').on(t.userId),
    tokenHashIdx: uniqueIndex('tokens_token_hash_idx').on(t.tokenHash),
  }),
);

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;

// ============================================================================
// Events (telemetry from the CLI)
// ============================================================================

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    username: text('username').notNull(),
    project: text('project').notNull().default('default'),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    clientIp: text('client_ip'),
    userAgent: text('user_agent'),
  },
  (t) => ({
    userIdx: index('events_user_idx').on(t.userId),
    usernameIdx: index('events_username_idx').on(t.username),
    typeIdx: index('events_type_idx').on(t.eventType),
    projectIdx: index('events_project_idx').on(t.project),
    occurredAtIdx: index('events_occurred_at_idx').on(t.occurredAt),
  }),
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

// ============================================================================
// Sessions (dashboard cookie sessions)
// ============================================================================

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionHash: text('session_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    sessionHashIdx: uniqueIndex('sessions_session_hash_idx').on(t.sessionHash),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// ============================================================================
// Audit log
// ============================================================================

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorUsername: text('actor_username'),
    action: text('action').notNull(),
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetUsername: text('target_username'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ip: text('ip'),
  },
  (t) => ({
    occurredAtIdx: index('audit_log_occurred_at_idx').on(t.occurredAt),
    actorIdx: index('audit_log_actor_idx').on(t.actorUserId),
  }),
);

export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;

// ============================================================================
// Settings (workspace-level config: time baselines per work type, etc.)
// ============================================================================

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull().$type<unknown>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

// ============================================================================
// Projects (enrollment allowlist)
// ============================================================================

export const projects = pgTable(
  'projects',
  {
    slug: text('slug').primaryKey(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    disabledByUserId: text('disabled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

// ============================================================================
// Corporate Skills (admin-managed versioned skill catalog)
// ============================================================================

export const corporateSkills = pgTable('corporate_skills', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(21)),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  tool: text('tool'),
  failClosed: boolean('fail_closed').notNull().default(false),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CorporateSkill = typeof corporateSkills.$inferSelect;
export type NewCorporateSkill = typeof corporateSkills.$inferInsert;

// ============================================================================
// Corporate Skill Versions (immutable content snapshots)
// ============================================================================

export const corporateSkillVersions = pgTable(
  'corporate_skill_versions',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid(21)),
    skillId: text('skill_id').notNull().references(() => corporateSkills.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    publishedByUserId: text('published_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqSkillVersion: uniqueIndex('uq_skill_version').on(t.skillId, t.version),
  }),
);

export type CorporateSkillVersion = typeof corporateSkillVersions.$inferSelect;
export type NewCorporateSkillVersion = typeof corporateSkillVersions.$inferInsert;
