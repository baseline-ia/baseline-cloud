import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1).default('postgres://baseline:baseline_dev@localhost:5432/baseline_cloud'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default('change-me-in-production-this-is-only-for-dev-min-32-chars'),
  TOKEN_PEPPER: z
    .string()
    .min(32, 'TOKEN_PEPPER must be at least 32 characters')
    .default('change-me-in-production-this-is-only-for-dev-min-32-chars'),

  COOKIE_SECURE: z
    .string()
    .default('true')
    .transform((s) => s.toLowerCase() !== 'false'),

  ALLOWED_ORIGINS: z.string().default('').transform((s) =>
    s
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ),

  BOOTSTRAP_ADMIN: z
    .string()
    .default('true')
    .transform((s) => s.toLowerCase() === 'true'),

  RATE_LIMIT_ENABLED: z
    .string()
    .optional()
    .transform((s) => (s == null ? undefined : s.toLowerCase() !== 'false')),
});

type RawConfig = z.infer<typeof ConfigSchema>;

export type AppConfig = Omit<RawConfig, 'RATE_LIMIT_ENABLED'> & {
  RATE_LIMIT_ENABLED: boolean;
};

function loadConfig(): AppConfig {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  const data = parsed.data as AppConfig;
  if (data.RATE_LIMIT_ENABLED === undefined) {
    data.RATE_LIMIT_ENABLED = data.NODE_ENV !== 'test';
  }
  return data;
}

export const config = loadConfig();
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
export const isDev = config.NODE_ENV === 'development';
