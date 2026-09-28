import fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { getEnv, AppEnv } from './config/env';
import { getDb, AppDatabase } from './db/client';
import { AuthRepository } from './db/repositories/auth.repository';
import { TopicRepository } from './db/repositories/topic.repository';
import { authRoutes } from './routes/auth.routes';
import { healthRoutes } from './routes/health.routes';
import fastifyStatic from '@fastify/static';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

export interface AppOptions {
  env?: AppEnv;
  db?: AppDatabase;
  logger?: boolean;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const env = options.env ?? getEnv();
  const db = options.db ?? getDb();

  const app = fastify({
    genReqId: () => randomUUID(),
    logger: options.logger ?? {
      level: env.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'body.passphrase', 'body.apiKey'],
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.ip,
          };
        },
      },
    },
    trustProxy: env.NODE_ENV === 'production',
  });

  // Security Hardening: Helmet
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // CORS: Restricted to configured client origin
  app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);
      const allowed = env.CORS_ORIGIN.split(',').map((o: string) => o.trim());
      if (allowed.includes(origin) || allowed.includes('*')) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Secure Cookies
  app.register(cookie, {
    secret: env.SESSION_SECRET,
  });

  // Rate Limiting with IETF standard draft headers
  app.register(rateLimit, {
    global: true,
    max: 120, // 120 requests per minute global baseline
    timeWindow: '1 minute',
    enableDraftSpec: true,
    addHeaders: {
      'ratelimit-limit': true,
      'ratelimit-remaining': true,
      'ratelimit-reset': true,
      'retry-after': true,
    },
    addHeadersOnExceeding: {
      'ratelimit-limit': true,
      'ratelimit-remaining': true,
      'ratelimit-reset': true,
    },
  });

  // Decorate fastify with db and repositories
  const authRepo = new AuthRepository(db);
  const topicRepo = new TopicRepository(db);
  app.decorate('db', db);
  app.decorate('authRepo', authRepo);
  app.decorate('topicRepo', topicRepo);
  app.decorate('env', env);

  // Register route modules
  app.register(healthRoutes);
  app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Serve static PWA assets in production if built
  const candidatePaths = [
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(process.cwd(), 'dist/client'),
  ];
  const webDist = candidatePaths.find((p) => fs.existsSync(p));

  if (webDist) {
    app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url && (request.raw.url.startsWith('/api') || request.raw.url === '/healthz' || request.raw.url === '/readyz')) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
          },
        });
      }
      return reply.sendFile('index.html');
    });
  }

  // Centralized Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode || (error.code === 'RATE_LIMIT_EXCEEDED' || error.code === 'FST_ERR_RATE_LIMIT_EXCEEDED' ? 429 : 500);
    request.log.error({ err: error, reqId: request.id }, 'Unhandled request error');

    if (statusCode === 429 || error.code === 'RATE_LIMIT_EXCEEDED' || error.code === 'FST_ERR_RATE_LIMIT_EXCEEDED') {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message || 'Too many requests. Please slow down.',
        },
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: error.validation,
        },
      });
    }

    return reply.status(statusCode).send({
      error: {
        code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : error.code || 'REQUEST_FAILED',
        message: statusCode === 500 ? 'An unexpected internal error occurred' : error.message,
      },
    });
  });

  return app;
}
