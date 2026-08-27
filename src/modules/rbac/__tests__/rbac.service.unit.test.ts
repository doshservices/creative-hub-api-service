import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, NotFoundError } from '../../../common/errors.js';
import { PERMISSIONS } from '../../../common/permissions.js';
import { RbacService } from '../service.js';
import type { AccountPermissionsPort, AuditRecorderPort, RoleRepositoryPort } from '../service.js';
import type { RoleDTO } from '../dto.js';

function buildRole(overrides: Partial<RoleDTO> = {}): RoleDTO {
  return {
    id: 'role-1',
    name: 'support-agent',
    permissions: [PERMISSIONS.LISTINGS_WRITE],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  roles?: Partial<RoleRepositoryPort>;
  accounts?: Partial<AccountPermissionsPort>;
  audit?: Partial<AuditRecorderPort>;
} = {}) {
  const roles: RoleRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildRole()),
    findById: vi.fn().mockResolvedValue(buildRole()),
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    updatePermissions: vi.fn().mockResolvedValue(buildRole({ permissions: [PERMISSIONS.HIRING_APPLY] })),
    ...overrides.roles,
  };
  const accounts: AccountPermissionsPort = {
    findById: vi.fn().mockResolvedValue({ id: 'account-1', permissions: [] }),
    updatePermissions: vi
      .fn()
      .mockResolvedValue({ id: 'account-1', permissions: [PERMISSIONS.LISTINGS_WRITE] }),
    ...overrides.accounts,
  };
  const audit: AuditRecorderPort = { record: vi.fn().mockResolvedValue(undefined), ...overrides.audit };

  const service = new RbacService(roles, accounts, audit);
  return { service, roles, accounts, audit };
}

describe('RbacService.createRole', () => {
  it('rejects a role that requests an unknown permission', async () => {
    const { service } = buildService();
    await expect(
      service.createRole({ name: 'bogus', permissions: ['not:a:real:permission'] }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('creates a role when every permission is known', async () => {
    const { service, roles } = buildService();
    await service.createRole({ name: 'support-agent', permissions: [PERMISSIONS.LISTINGS_WRITE] });
    expect(roles.create).toHaveBeenCalledWith({
      name: 'support-agent',
      permissions: [PERMISSIONS.LISTINGS_WRITE],
    });
  });
});

describe('RbacService.getRole', () => {
  it('throws NotFoundError for a missing role', async () => {
    const { service } = buildService({ roles: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(service.getRole('role-1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('RbacService.updateRolePermissions', () => {
  it('rejects an unknown permission', async () => {
    const { service } = buildService();
    await expect(
      service.updateRolePermissions('role-1', ['not:a:real:permission']),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws NotFoundError when the role does not exist', async () => {
    const { service } = buildService({
      roles: { updatePermissions: vi.fn().mockResolvedValue(null) },
    });
    await expect(
      service.updateRolePermissions('role-1', [PERMISSIONS.HIRING_APPLY]),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('RbacService.assignRoleToAccount', () => {
  it('throws NotFoundError when the role does not exist', async () => {
    const { service } = buildService({ roles: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.assignRoleToAccount('actor-1', 'account-1', 'role-1'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when the account does not exist', async () => {
    const { service } = buildService({ accounts: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.assignRoleToAccount('actor-1', 'account-1', 'role-1'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("replaces the account's permissions with the role's and records an audit entry", async () => {
    const { service, accounts, audit } = buildService();

    const result = await service.assignRoleToAccount('actor-1', 'account-1', 'role-1');

    expect(accounts.updatePermissions).toHaveBeenCalledWith('account-1', [
      PERMISSIONS.LISTINGS_WRITE,
    ]);
    expect(result.permissions).toEqual([PERMISSIONS.LISTINGS_WRITE]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        action: 'rbac.role_assigned',
        targetType: 'account',
        targetId: 'account-1',
      }),
    );
  });
});

describe('RbacService.listPermissionsCatalog', () => {
  it('returns every known permission string', () => {
    const { service } = buildService();
    const catalog = service.listPermissionsCatalog();
    expect(catalog).toEqual(expect.arrayContaining(Object.values(PERMISSIONS)));
  });
});
