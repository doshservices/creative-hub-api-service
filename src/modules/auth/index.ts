import type { FastifyInstance } from 'fastify';
import { AccountRepository } from './repository.js';
import { AuthService } from './service.js';
import { AuthController } from './controller.js';
import { registerAuthRoutes } from './routes.js';

export { AccountRepository } from './repository.js';
export type { AccountDTO } from './dto.js';
export type { AccountType } from './model.js';

// Not wrapped in fastify-plugin: this module needs its own encapsulated context so the
// `{ prefix: '/auth' }` passed at registration actually applies to its routes. It still sees
// app.mongo/app.redis/app.jwt/app.audit/app.authenticate/app.config, which are decorated on
// the parent instance before this module is registered.
export default async function authModule(app: FastifyInstance): Promise<void> {
  const accountRepository = new AccountRepository(app.mongo.db);
  await accountRepository.createIndexes();

  const authService = new AuthService(accountRepository, app.redis, app.jwt, app.audit, {
    accessTtl: app.config.jwt.accessTtl,
    refreshTtlSeconds: app.config.jwt.refreshTtlSeconds,
  });
  const controller = new AuthController(authService);
  registerAuthRoutes(app, controller);
}
