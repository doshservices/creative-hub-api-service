import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors.js';
import { PERMISSIONS } from '../../common/permissions.js';
import { DuplicateRoleNameError } from './repository.js';
import type { RoleDTO, RolePage } from './dto.js';

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface CreateRoleInput {
  name: string;
  permissions: string[];
}

export interface RoleRepositoryPort {
  create(input: CreateRoleInput): Promise<RoleDTO>;
  findById(id: string): Promise<RoleDTO | null>;
  list(params: PageParams): Promise<RolePage>;
  updatePermissions(id: string, permissions: string[]): Promise<RoleDTO | null>;
}

export interface AccountPermissionsPort {
  findById(id: string): Promise<{ id: string; permissions: string[] } | null>;
  updatePermissions(
    id: string,
    permissions: string[],
  ): Promise<{ id: string; permissions: string[] } | null>;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
}

const KNOWN_PERMISSIONS: ReadonlySet<string> = new Set(Object.values(PERMISSIONS));

function assertKnownPermissions(permissions: string[]): void {
  const unknown = permissions.filter((permission) => !KNOWN_PERMISSIONS.has(permission));
  if (unknown.length > 0) {
    throw new BadRequestError(`Unknown permission(s): ${unknown.join(', ')}`);
  }
}

export class RbacService {
  constructor(
    private readonly roles: RoleRepositoryPort,
    private readonly accounts: AccountPermissionsPort,
    private readonly audit: AuditRecorderPort,
  ) {}

  // The full catalog a role's permissions must be drawn from — the client-facing reference for
  // what's assignable at all.
  listPermissionsCatalog(): string[] {
    return [...KNOWN_PERMISSIONS];
  }

  async createRole(input: CreateRoleInput): Promise<RoleDTO> {
    assertKnownPermissions(input.permissions);
    try {
      return await this.roles.create(input);
    } catch (error) {
      if (error instanceof DuplicateRoleNameError) {
        throw new ConflictError(`A role named "${input.name}" already exists`);
      }
      throw error;
    }
  }

  async getRole(id: string): Promise<RoleDTO> {
    const role = await this.roles.findById(id);
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    return role;
  }

  async listRoles(params: PageParams): Promise<RolePage> {
    return this.roles.list(params);
  }

  async updateRolePermissions(id: string, permissions: string[]): Promise<RoleDTO> {
    assertKnownPermissions(permissions);
    const updated = await this.roles.updatePermissions(id, permissions);
    if (!updated) {
      throw new NotFoundError('Role not found');
    }
    return updated;
  }

  // Assigning a role *replaces* the account's permission set with exactly that role's
  // permissions — accounts hold one effective role at a time in this first pass, not a union of
  // several. A permission change is one of CLAUDE.md's audit-required actions.
  async assignRoleToAccount(
    actorId: string,
    accountId: string,
    roleId: string,
  ): Promise<{ accountId: string; permissions: string[] }> {
    const role = await this.getRole(roleId);
    const account = await this.accounts.findById(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const updated = await this.accounts.updatePermissions(accountId, role.permissions);
    if (!updated) {
      throw new NotFoundError('Account not found');
    }

    await this.audit.record({
      actorId,
      action: 'rbac.role_assigned',
      targetType: 'account',
      targetId: accountId,
      metadata: { roleId, roleName: role.name },
    });

    return { accountId: updated.id, permissions: updated.permissions };
  }
}
