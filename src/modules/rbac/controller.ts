import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PageParams, RbacService } from './service.js';

export interface CreateRoleBody {
  name: string;
  permissions: string[];
}

export interface UpdateRolePermissionsBody {
  permissions: string[];
}

export interface AssignRoleBody {
  roleId: string;
}

export interface RoleIdParams {
  id: string;
}

export interface AccountIdParams {
  accountId: string;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

function pageParams(query: ListQuery): PageParams {
  return {
    limit: query.limit ?? 20,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class RbacController {
  constructor(private readonly service: RbacService) {}

  listPermissionsCatalog = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await reply.send({ success: true, data: { permissions: this.service.listPermissionsCatalog() } });
  };

  createRole = async (
    request: FastifyRequest<{ Body: CreateRoleBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.createRole(request.body);
    await reply.code(201).send({ success: true, data });
  };

  getRole = async (
    request: FastifyRequest<{ Params: RoleIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getRole(request.params.id);
    await reply.send({ success: true, data });
  };

  listRoles = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listRoles(pageParams(request.query));
    await reply.send({ success: true, data });
  };

  updateRolePermissions = async (
    request: FastifyRequest<{ Params: RoleIdParams; Body: UpdateRolePermissionsBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.updateRolePermissions(
      request.params.id,
      request.body.permissions,
    );
    await reply.send({ success: true, data });
  };

  assignRole = async (
    request: FastifyRequest<{ Params: AccountIdParams; Body: AssignRoleBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.assignRoleToAccount(
      request.user.sub,
      request.params.accountId,
      request.body.roleId,
    );
    await reply.send({ success: true, data });
  };
}
