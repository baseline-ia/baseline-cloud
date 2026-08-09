import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://baseline:baseline_dev@localhost:5432/baseline_cloud',
  },
  verbose: true,
  strict: true,
} satisfies Config;
