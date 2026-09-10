import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type { AdminAuditQuery, AuditController } from './controller.js';
import { adminAuditQuerySchema, auditEntryPageResponseSchema } from './schema.js';

// Admin audit-log viewer — read-only, gated by AUDIT_READ. Audit rows themselves are written
// internally by other modules via the app.audit decorator (see src/plugins/audit.ts); this is
// the only HTTP surface this module has.
export function registerAuditRoutes(app: FastifyInstance, controller: AuditController): void {
  const requireAuditRead = app.requirePermission(PERMISSIONS.AUDIT_READ);

  app.get<{ Querystring: AdminAuditQuery }>(
    '/audit',
    {
      preHandler: [app.authenticate, requireAuditRead],
      schema: { querystring: adminAuditQuerySchema, response: { 200: auditEntryPageResponseSchema } },
    },
    controller.listAudit,
  );
}
