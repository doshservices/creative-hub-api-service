import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  AccountIdParams,
  AssignRoleBody,
  CreateRoleBody,
  ListQuery,
  RbacController,
  RoleIdParams,
  UpdateRolePermissionsBody,
} from './controller.js';
import {
  accountIdParamSchema,
  assignRoleBodySchema,
  createRoleBodySchema,
  listQuerySchema,
  permissionsCatalogResponseSchema,
  roleAssignmentResponseSchema,
  roleIdParamSchema,
  rolePageResponseSchema,
  roleResponseSchema,
  updateRolePermissionsBodySchema,
} from './schema.js';

// Every route here is gated on rbac:manage — there is no ownership dimension (roles and
// account-permission assignment are an admin-wide capability, not a self-owned resource).
export function registerRbacRoutes(app: FastifyInstance, controller: RbacController): void {
  const requireRbacManage = app.requirePermission(PERMISSIONS.RBAC_MANAGE);

  app.get(
    '/permissions',
    {
      preHandler: [app.authenticate, requireRbacManage],
      schema: {
        tags: ['RBAC'],
        summary: 'List the full catalog of permissions',
        description:
          "**Admin only** — requires `rbac:manage`. This permission isn't granted to any account type by default; the first admin has to be granted it directly (e.g. a one-off script or database write), after which that admin can assign roles carrying it to other accounts through this same API.",
        response: { 200: permissionsCatalogResponseSchema },
      },
    },
    controller.listPermissionsCatalog,
  );

  app.post<{ Body: CreateRoleBody }>(
    '/roles',
    {
      preHandler: [app.authenticate, requireRbacManage],
      schema: {
        tags: ['RBAC'],
        summary: 'Create a role',
        description:
          "**Admin only** — requires `rbac:manage`. This permission isn't granted to any account type by default; the first admin has to be granted it directly (e.g. a one-off script or database write), after which that admin can assign roles carrying it to other accounts through this same API.",
        body: createRoleBodySchema,
        response: { 201: roleResponseSchema },
      },
    },
    controller.createRole,
  );

  app.get<{ Querystring: ListQuery }>(
    '/roles',
    {
      preHandler: [app.authenticate, requireRbacManage],
      schema: {
        tags: ['RBAC'],
        summary: 'List roles',
        description:
          "**Admin only** — requires `rbac:manage`. This permission isn't granted to any account type by default; the first admin has to be granted it directly (e.g. a one-off script or database write), after which that admin can assign roles carrying it to other accounts through this same API.",
        querystring: listQuerySchema,
        response: { 200: rolePageResponseSchema },
      },
    },
    controller.listRoles,
  );

  app.get<{ Params: RoleIdParams }>(
    '/roles/:id',
    {
      preHandler: [app.authenticate, requireRbacManage],
      schema: {
        tags: ['RBAC'],
        summary: 'Get a role by id',
        description:
          "**Admin only** — requires `rbac:manage`. This permission isn't granted to any account type by default; the first admin has to be granted it directly (e.g. a one-off script or database write), after which that admin can assign roles carrying it to other accounts through this same API.",
        params: roleIdParamSchema,
        response: { 200: roleResponseSchema },
      },
    },
    controller.getRole,
  );

  app.put<{ Params: RoleIdParams; Body: UpdateRolePermissionsBody }>(
    '/roles/:id/permissions',
    {
      preHandler: [app.authenticate, requireRbacManage],
      schema: {
        tags: ['RBAC'],
        summary: "Replace a role's permission set",
        description:
          "**Admin only** — requires `rbac:manage`. This permission isn't granted to any account type by default; the first admin has to be granted it directly (e.g. a one-off script or database write), after which that admin can assign roles carrying it to other accounts through this same API.",
        params: roleIdParamSchema,
        body: updateRolePermissionsBodySchema,
        response: { 200: roleResponseSchema },
      },
    },
    controller.updateRolePermissions,
  );

  app.post<{ Params: AccountIdParams; Body: AssignRoleBody }>(
    '/accounts/:accountId/role',
    {
      preHandler: [app.authenticate, requireRbacManage],
      schema: {
        tags: ['RBAC'],
        summary: 'Assign a role to an account',
        description:
          "**Admin only** — requires `rbac:manage`. This permission isn't granted to any account type by default; the first admin has to be granted it directly (e.g. a one-off script or database write), after which that admin can assign roles carrying it to other accounts through this same API.",
        params: accountIdParamSchema,
        body: assignRoleBodySchema,
        response: { 200: roleAssignmentResponseSchema },
      },
    },
    controller.assignRole,
  );
}
