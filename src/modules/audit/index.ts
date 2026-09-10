import type { FastifyInstance } from 'fastify';
import { AuditRepository } from './repository.js';
import { AuditService } from './service.js';
import { AuditController } from './controller.js';
import { registerAuditRoutes } from './routes.js';

export { AuditRepository } from './repository.js';
export type { AuditEntryListParams, CreateAuditEntryInput } from './repository.js';
export { AuditService } from './service.js';
export type { AuditWriterPort } from './service.js';
export type { AuditEntryDTO, AuditEntryPage } from './dto.js';

// Read-only HTTP surface for the audit log (GET /admin/audit) — the write path stays internal,
// via the `app.audit` decorator every other module already uses (see src/plugins/audit.ts,
// which is registered separately, before this module, and already runs createIndexes() against
// the same collection/index list in model.ts — nothing more to create here). This registration
// only adds the admin read route on top of that collection, mounted at the shared `/admin`
// prefix alongside the `admin` composition module.
export default function auditRoutesModule(app: FastifyInstance): Promise<void> {
  const repository = new AuditRepository(app.mongo.db);
  const service = new AuditService(repository);
  const controller = new AuditController(service);
  registerAuditRoutes(app, controller);
  return Promise.resolve();
}
