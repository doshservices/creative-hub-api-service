import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { AccountRepository } from './repository.js';
import { AuthService } from './service.js';
import { AuthController } from './controller.js';
import { registerAuthRoutes } from './routes.js';
import type { AccountType } from './model.js';

export { AccountRepository } from './repository.js';
export { AuthService } from './service.js';
export type { AccountDTO, AccountPage } from './dto.js';
export type { AccountType } from './model.js';

// Cheap total-count export for the admin composition module's stats endpoint — same "plain
// function taking db, constructs its own repository" pattern as wallet/index.ts's
// getBalancesByAccountIds and identity/index.ts's getStatusesByAccountIds.
export async function countAccounts(db: Db, accountType?: AccountType): Promise<number> {
  return new AccountRepository(db).count(accountType);
}

// Signups-per-day for the admin composition module's timeseries stat — same "plain function
// taking db, constructs its own repository" pattern as countAccounts above.
export async function getSignupsByDay(
  db: Db,
  params: { from: Date; to: Date; accountType?: AccountType },
): Promise<Array<{ date: string; count: number }>> {
  return new AccountRepository(db).countByDayForRange(params);
}

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
