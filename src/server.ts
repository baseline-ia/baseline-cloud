import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isDev, isProd } from './config.js';
import { registerAuthMiddleware } from './auth/middleware.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerEventsRoutes } from './routes/events.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { runMigrations } from './db/migrate.js';
import { i18nHook, resolveLocale, type Locale } from './i18n/index.js';
import type { ResolvedToken, DashboardSession } from './auth/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

declare module 'fastify' {
  interface FastifyRequest {
    authToken?: ResolvedToken;
    dashboardSession?: DashboardSession;
  }
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  await runMigrations();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
    },
    trustProxy: true,
  });

  // Content-type parser for HTML forms (login form posts application/x-www-form-urlencoded)
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body: string, done) => {
      const params = new URLSearchParams(body);
      const out: Record<string, string> = {};
      for (const [k, v] of params.entries()) out[k] = v;
      done(null, out);
    },
  );

  // Plugins
  await app.register(fastifyCookie, { secret: config.JWT_SECRET });
  await app.register(fastifyStatic, {
    root: join(__dirname, '..', 'public'),
    prefix: '/public/',
    decorateReply: false,
  });
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // HTMX inlines some attributes
          'https://cdn.jsdelivr.net', // Chart.js
        ],
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net', // Pico CSS
          'https://fonts.googleapis.com', // Google Fonts CSS
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(fastifyRateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
  });

  // Auth middleware (decorators for /v1/events and /dashboard/*)
  registerAuthMiddleware(app);

  // i18n: attach `locale` + `t(key)` to every request
  app.decorateRequest('locale', null as Locale | null);
  app.decorateRequest('t', null as ((key: string) => string) | null);
  app.addHook('preHandler', async (req) => {
    await i18nHook(req, undefined);
  });

  // `authenticate` decorator for explicit use in route configs
  app.decorate('authenticate', async (req: any, reply: any) => {
    const header = req.headers.authorization;
    if (!header) {
      reply.code(401).send({ error_class: 'auth', error_code: 'missing_token' });
      return;
    }
    const m = /^Bearer (.+)$/.exec(header);
    if (!m || !m[1]) {
      reply.code(401).send({ error_class: 'auth', error_code: 'malformed_token' });
      return;
    }
    const { resolveBearerToken } = await import('./auth/index.js');
    const resolved = await resolveBearerToken(m[1]);
    if (!resolved) {
      reply.code(401).send({ error_class: 'auth', error_code: 'invalid_token' });
      return;
    }
    req.authToken = resolved;
  });

  // Routes
  await registerAuthRoutes(app);
  await registerEventsRoutes(app);
  await registerDashboardRoutes(app);

  // Root redirect
  app.get('/', async (req, reply) => {
    return reply.redirect('/dashboard/');
  });

  // Locale switcher: sets the baseline_locale cookie and redirects back
  app.get('/dashboard/set-locale', async (req, reply) => {
    const locale = String((req.query as Record<string, string>).locale ?? '').toLowerCase();
    if (locale !== 'en' && locale !== 'es') {
      return reply.code(400).send('Invalid locale');
    }
    reply.setCookie('baseline_locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      httpOnly: false, // readable by client-side scripts if needed
    });
    const redirectTo = String((req.query as Record<string, string>).next ?? '/dashboard/');
    return reply.redirect(redirectTo.startsWith('/') ? redirectTo : '/dashboard/');
  });

  // Health
  app.get('/health', async () => {
    return { status: 'ok', service: 'baseline-cloud', env: config.NODE_ENV };
  });

  return app;
}

export async function start() {
  const app = await buildApp();
  try {
    const address = await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`baseline-cloud listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
