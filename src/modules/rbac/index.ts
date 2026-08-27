import type { FastifyInstance } from 'fastify';
import { AccountRepository } from '../auth/index.js';
import { RoleRepository } from './repository.js';
import { RbacService } from './service.js';
import { RbacController } from './controller.js';
import { registerRbacRoutes } from './routes.js';

export { RoleRepository } from './repository.js';
export { RbacService } from './service.js';
export type { RoleDTO, RolePage } from './dto.js';

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/rbac' }`
// to apply, same reasoning as the other route-registering modules.
export default async function rbacModule(app: FastifyInstance): Promise<void> {
  const roleRepository = new RoleRepository(app.mongo.db);
  await roleRepository.createIndexes();

  // Cross-module write through auth's public surface (its index.ts) — never auth's model or
  // collection directly. Role assignment mutates the account's permissions, which auth owns.
  const accountRepository = new AccountRepository(app.mongo.db);

  const service = new RbacService(roleRepository, accountRepository, app.audit);
  const controller = new RbacController(service);
  registerRbacRoutes(app, controller);
}
