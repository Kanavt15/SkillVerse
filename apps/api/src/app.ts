/**
 * Builds the Hono application: middleware order matters and is documented here.
 *
 *   request
 *     → requestContext   request ID, logger, DB client
 *     → securityHeaders  strict headers on every response (incl. errors)
 *     → rateLimit        per-IP brake on /api/v1/*
 *     → rateLimit        stricter per-IP brake on /api/v1/auth/*
 *     → requireHuman     Turnstile bot check on register/login/forgot/resend (if configured)
 *     → csrfProtection   Origin + custom-header check on non-GET requests
 *     → bodyLimit        reject bodies over 64 KB before parsing
 *     → loadSession      resolve the session cookie → c.var.auth (or null)
 *     → routes           (protected routers add requireAuth / requireRole)
 *   errors thrown anywhere → errorHandler → standard JSON error body
 */
import { bodyLimit } from 'hono/body-limit';
import { Scalar } from '@scalar/hono-api-reference';
import { SESSION_COOKIE_DEV } from '@skillverse/shared';
import { AppError } from './lib/errors';
import { createRouter } from './lib/openapi';
import { loadSession } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { rateLimit } from './middleware/rate-limit';
import { requestContext } from './middleware/request-context';
import { securityHeaders } from './middleware/security-headers';
import { requireHuman } from './middleware/turnstile';
import { authRoutes } from './routes/auth.routes';
import { categoryRoutes } from './routes/categories.routes';
import { devRoutes } from './routes/dev.routes';
import { healthRoutes } from './routes/health.routes';
import { meRoutes } from './routes/me.routes';
import { mfaRoutes } from './routes/mfa.routes';
import { oauthRoutes } from './routes/oauth.routes';
import { metaRoutes } from './routes/meta.routes';

const MAX_JSON_BODY_BYTES = 64 * 1024;

export function createApp() {
  const app = createRouter();

  app.use('*', requestContext);
  app.use('*', securityHeaders);
  app.use('/api/v1/*', rateLimit('RL_API', 'api'));
  app.use('/api/v1/auth/*', rateLimit('RL_AUTH', 'auth'));
  // Bot check (Cloudflare Turnstile) on the forms bots target most. No-op unless configured.
  for (const path of ['register', 'login', 'forgot-password', 'resend-verification']) {
    app.use(`/api/v1/auth/${path}`, requireHuman());
  }
  app.use('*', csrfProtection);
  app.use(
    '*',
    bodyLimit({
      maxSize: MAX_JSON_BODY_BYTES,
      onError: () => {
        throw new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large.');
      },
    }),
  );

  app.use('/api/v1/*', loadSession);

  app.route('/api', healthRoutes);
  app.route('/api/v1', metaRoutes);
  app.route('/api/v1', categoryRoutes);
  app.route('/api/v1', authRoutes);
  app.route('/api/v1', meRoutes);
  app.route('/api/v1', mfaRoutes);
  app.route('/api/v1', oauthRoutes);
  app.route('/api/v1', devRoutes);

  app.openAPIRegistry.registerComponent('securitySchemes', 'session', {
    type: 'apiKey',
    in: 'cookie',
    name: SESSION_COOKIE_DEV,
    description: 'Session cookie set by /auth/login. Named "__Host-sv_session" on HTTPS.',
  });

  mountApiDocs(app);

  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}

/**
 * Interactive API docs at /api/docs (OpenAPI spec at /api/openapi.json).
 * Disabled in production to avoid handing attackers a map of the API.
 */
function mountApiDocs(app: ReturnType<typeof createRouter>) {
  app.use('/api/docs', async (c, next) => {
    if (c.env.ENVIRONMENT === 'production') return c.notFound();
    await next();
    // The docs UI loads its script from jsDelivr, so relax the API's "load nothing" CSP here only.
    c.res.headers.set(
      'Content-Security-Policy',
      "default-src 'none'; script-src https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'",
    );
  });
  app.use('/api/openapi.json', async (c, next) => {
    if (c.env.ENVIRONMENT === 'production') return c.notFound();
    return next();
  });

  app.doc31('/api/openapi.json', (c) => ({
    openapi: '3.1.0',
    info: {
      title: 'SkillVerse API',
      version: '1.0.0',
      description: 'Generated from the route schemas in apps/api/src/routes.',
    },
    servers: [{ url: new URL(c.req.url).origin }],
  }));
  app.get('/api/docs', Scalar({ url: '/api/openapi.json', pageTitle: 'SkillVerse API' }));
}

export type App = ReturnType<typeof createApp>;
