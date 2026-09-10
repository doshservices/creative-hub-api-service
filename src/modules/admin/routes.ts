import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type { AdminController, ListQuery } from './controller.js';
import {
  employerPageResponseSchema,
  listQuerySchema,
  statsResponseSchema,
  talentPageResponseSchema,
} from './schema.js';

export function registerAdminRoutes(app: FastifyInstance, controller: AdminController): void {
  // Every route in this module reads across other modules' data — one permission gates all of
  // it, per CLAUDE.md's guidance to reuse ADMIN_USERS_MANAGE rather than invent a second admin
  // permission for a read-only composition layer with no mutations of its own.
  const requireAdminUsersManage = app.requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE);

  app.get<{ Querystring: ListQuery }>(
    '/talents',
    {
      preHandler: [app.authenticate, requireAdminUsersManage],
      schema: { querystring: listQuerySchema, response: { 200: talentPageResponseSchema } },
    },
    controller.listTalents,
  );

  app.get<{ Querystring: ListQuery }>(
    '/employers',
    {
      preHandler: [app.authenticate, requireAdminUsersManage],
      schema: { querystring: listQuerySchema, response: { 200: employerPageResponseSchema } },
    },
    controller.listEmployers,
  );

  app.get(
    '/stats',
    {
      preHandler: [app.authenticate, requireAdminUsersManage],
      schema: { response: { 200: statsResponseSchema } },
    },
    controller.stats,
  );
}
