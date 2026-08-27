import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { loadEnv } from './config/env.js';
import configPlugin from './plugins/config.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import docsPlugin from './plugins/docs.js';
import mongoPlugin from './plugins/mongo.js';
import redisPlugin from './plugins/redis.js';
import jwtAuthPlugin from './plugins/auth.js';
import s3Plugin from './plugins/s3.js';
import auditPlugin from './plugins/audit.js';
import authModule from './modules/auth/index.js';
import usersModule from './modules/users/index.js';
import listingsModule from './modules/listings/index.js';
import hiringModule from './modules/hiring/index.js';
import messagingModule from './modules/messaging/index.js';
import notificationsModule from './modules/notifications/index.js';
import identityModule from './modules/identity/index.js';
import walletModule from './modules/wallet/index.js';
import paymentsModule from './modules/payments/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  // Fastify's logger is configured at construction time, before any plugin (including
  // configPlugin) runs — this is the one place outside config/env.ts allowed to call loadEnv().
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.token',
          '*.otp',
          '*.secret',
          '*.bvn',
          '*.nin',
          '*.cardNumber',
        ],
        censor: '[REDACTED]',
      },
      ...(env.isProduction ? {} : { transport: { target: 'pino-pretty' } }),
    },
  });

  // Order matters: config first (everything else reads app.config), error handling next so
  // it's in place before any route can throw, then infra plugins, then docs, then modules.
  await app.register(configPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(cors, { origin: app.config.cors.origin });
  await app.register(mongoPlugin);
  await app.register(redisPlugin);
  await app.register(jwtAuthPlugin);
  await app.register(s3Plugin);
  await app.register(auditPlugin);
  await app.register(docsPlugin);

  app.get('/health', { logLevel: 'silent' }, () => ({ status: 'ok' }));

  await app.register(authModule, { prefix: '/auth' });
  await app.register(usersModule, { prefix: '/users' });
  await app.register(listingsModule, { prefix: '/listings' });
  await app.register(hiringModule, { prefix: '/hiring' });
  await app.register(messagingModule, { prefix: '/messaging' });
  await app.register(notificationsModule, { prefix: '/notifications' });
  await app.register(identityModule, { prefix: '/identity' });
  await app.register(walletModule, { prefix: '/wallet' });
  await app.register(paymentsModule, { prefix: '/payments' });

  return app;
}
