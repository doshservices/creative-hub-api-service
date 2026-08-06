import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { AuditRepository, AuditService } from '../modules/audit/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    audit: AuditService;
  }
}

// Shared audit writer decorated on the root instance so any module can record a sensitive
// action without reaching into another module's repository — see CLAUDE.md's audit invariant.
export default fp(async function auditPlugin(app: FastifyInstance) {
  const repository = new AuditRepository(app.mongo.db);
  await repository.createIndexes();
  app.decorate('audit', new AuditService(repository));
});
