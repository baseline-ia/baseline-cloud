/**
 * Test setup — runs before all tests.
 *
 * - Connects to a test Postgres (DATABASE_URL_TEST or default to test DB)
 * - Runs migrations once
 * - Truncates all tables before each test for isolation
 *
 * Set TEST_DATABASE_URL to override. Default:
 *   postgres://baseline:baseline_dev@localhost:5442/baseline_cloud_test
 */
import { beforeAll, beforeEach, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../src/db/schema';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://baseline:baseline_dev@localhost:5442/baseline_cloud_test';

process.env.DATABASE_URL = TEST_DB_URL;

export const testSql = postgres(TEST_DB_URL, { max: 5 });
export const testDb = drizzle(testSql, { schema });

beforeAll(async () => {
  // Drop everything (including the drizzle migration journal in its own
  // schema) so the migration runner re-applies from scratch. Without
  // dropping the journal, the migrator would see "all migrations
  // applied" and skip, leaving us with no tables.
  await testSql.unsafe(`
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    DROP TABLE IF EXISTS audit_log CASCADE;
    DROP TABLE IF EXISTS settings CASCADE;
    DROP TABLE IF EXISTS events CASCADE;
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS tokens CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);
  await migrate(testDb, { migrationsFolder: './src/db/migrations' });
});

beforeEach(async () => {
  // Wipe data between tests (keep schema). Order matters: child tables first.
  await testSql.unsafe(`
    TRUNCATE TABLE audit_log RESTART IDENTITY CASCADE;
    TRUNCATE TABLE settings RESTART IDENTITY CASCADE;
    TRUNCATE TABLE events RESTART IDENTITY CASCADE;
    TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;
    TRUNCATE TABLE tokens RESTART IDENTITY CASCADE;
    TRUNCATE TABLE users RESTART IDENTITY CASCADE;
  `);
});

afterAll(async () => {
  await testSql.end({ timeout: 5 });
});

// Re-export schema so tests can use the table objects directly
export { schema };
