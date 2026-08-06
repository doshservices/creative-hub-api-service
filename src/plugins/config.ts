import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { loadEnv, type AppConfig } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

// Registered first — every other plugin reads config off `app.config`, never `process.env`.
export default fp(function configPlugin(app: FastifyInstance) {
  app.decorate('config', loadEnv());
});
