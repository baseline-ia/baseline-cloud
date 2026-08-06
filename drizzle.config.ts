import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://baseline:baseline_dev@localhost:5432/baseline_cloud',
  },
  verbose: true,
  strict: true,
} satisfies Config;
