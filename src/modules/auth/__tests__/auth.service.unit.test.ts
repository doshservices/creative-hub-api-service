import { describe, expect, it, vi } from 'vitest';
import { ConflictError, UnauthorizedError } from '../../../common/errors.js';
import { PERMISSIONS } from '../../../common/permissions.js';
import type { AccountDTO } from '../dto.js';
import type { AccountType } from '../model.js';
import { hashPassword } from '../password.js';
import type {
  AccountRepositoryPort,
  AuditRecorderPort,
  RefreshTokenStorePort,
  RegisterInput,
  TokenSignerPort,
} from '../service.js';
import { AuthService } from '../service.js';

function buildAccount(overrides: Partial<AccountDTO> = {}): AccountDTO {
  return {
    id: 'account-1',
    email: 'dev@example.com',
    firstName: 'Dev',
    lastName: 'User',
    accountType: 'creative',
    permissions: [],
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildRegisterInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  return {
    email: 'dev@example.com',
    password: 'password123',
    firstName: 'Dev',
    lastName: 'User',
    accountType: 'creative',
    ...overrides,
  };
}

function buildService(overrides: {
  repository?: Partial<AccountRepositoryPort>;
  refreshTokens?: Partial<RefreshTokenStorePort>;
  signer?: Partial<TokenSignerPort>;
  audit?: Partial<AuditRecorderPort>;
}) {
  const repository: AccountRepositoryPort = {
    findByEmailWithCredentials: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(buildAccount()),
    findById: vi.fn().mockResolvedValue(null),
    ...overrides.repository,
  };
  const refreshTokens: RefreshTokenStorePort = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    ...overrides.refreshTokens,
  };
  const signer: TokenSignerPort = {
    sign: vi.fn().mockReturnValue('signed-access-token'),
    ...overrides.signer,
  };
  const audit: AuditRecorderPort = {
    record: vi.fn().mockResolvedValue(undefined),
    ...overrides.audit,
  };

  const service = new AuthService(repository, refreshTokens, signer, audit, {
    accessTtl: '15m',
    refreshTtlSeconds: 3600,
  });

  return { service, repository, refreshTokens, signer, audit };
}

describe('AuthService.register', () => {
  it('creates an account and issues tokens when the email is free', async () => {
    const { service, repository, refreshTokens } = buildService({});

    const tokens = await service.register(buildRegisterInput());

    expect(tokens.accessToken).toBe('signed-access-token');
    expect(tokens.refreshToken).toHaveLength(64);
    expect(repository.create).toHaveBeenCalledWith({
      email: 'dev@example.com',
      passwordHash: expect.any(String),
      firstName: 'Dev',
      lastName: 'User',
      accountType: 'creative',
      permissions: [
        PERMISSIONS.CREATIVE_PROFILE_WRITE,
        PERMISSIONS.HIRING_APPLY,
        PERMISSIONS.IDENTITY_VERIFY,
      ],
    });
    expect(refreshTokens.set).toHaveBeenCalledWith(
      `auth:refresh:${tokens.refreshToken}`,
      'account-1',
      'EX',
      3600,
    );
  });

  it.each<[AccountType, string[]]>([
    [
      'creative',
      [PERMISSIONS.CREATIVE_PROFILE_WRITE, PERMISSIONS.HIRING_APPLY, PERMISSIONS.IDENTITY_VERIFY],
    ],
    ['client', [PERMISSIONS.LISTINGS_WRITE]],
  ])('grants the default permission set for a %s account', async (accountType, permissions) => {
    const { service, repository } = buildService({});

    await service.register(buildRegisterInput({ accountType }));

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ accountType, permissions }),
    );
  });

  it('rejects registration when the email is already taken', async () => {
    const { service } = buildService({
      repository: {
        findByEmailWithCredentials: vi
          .fn()
          .mockResolvedValue({ ...buildAccount(), passwordHash: 'irrelevant' }),
      },
    });

    await expect(service.register(buildRegisterInput())).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('AuthService.login', () => {
  it('issues tokens and records an audit entry on correct credentials', async () => {
    const passwordHash = await hashPassword('password123');
    const { service, audit } = buildService({
      repository: {
        findByEmailWithCredentials: vi.fn().mockResolvedValue({ ...buildAccount(), passwordHash }),
      },
    });

    const tokens = await service.login('dev@example.com', 'password123');

    expect(tokens.accessToken).toBe('signed-access-token');
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'account-1',
      action: 'auth.login',
      targetType: 'account',
      targetId: 'account-1',
    });
  });

  it('rejects an unknown email without revealing which part was wrong', async () => {
    const { service } = buildService({});

    await expect(service.login('nobody@example.com', 'password123')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await hashPassword('password123');
    const { service, audit } = buildService({
      repository: {
        findByEmailWithCredentials: vi.fn().mockResolvedValue({ ...buildAccount(), passwordHash }),
      },
    });

    await expect(service.login('dev@example.com', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const { service, refreshTokens } = buildService({
      refreshTokens: {
        get: vi.fn().mockResolvedValue('account-1'),
      },
      repository: {
        findById: vi.fn().mockResolvedValue(buildAccount()),
      },
    });

    const tokens = await service.refresh('old-refresh-token');

    expect(refreshTokens.del).toHaveBeenCalledWith('auth:refresh:old-refresh-token');
    expect(tokens.accessToken).toBe('signed-access-token');
    expect(tokens.refreshToken).not.toBe('old-refresh-token');
  });

  it('rejects a refresh token that is not in the store', async () => {
    const { service } = buildService({});

    await expect(service.refresh('missing-token')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a refresh token whose account no longer exists', async () => {
    const { service } = buildService({
      refreshTokens: { get: vi.fn().mockResolvedValue('account-1') },
      repository: { findById: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.refresh('stale-token')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('AuthService.logout', () => {
  it('deletes the refresh token from the store', async () => {
    const { service, refreshTokens } = buildService({});

    await service.logout('some-refresh-token');

    expect(refreshTokens.del).toHaveBeenCalledWith('auth:refresh:some-refresh-token');
  });
});

describe('AuthService.getById', () => {
  it('returns the account when found', async () => {
    const { service } = buildService({
      repository: { findById: vi.fn().mockResolvedValue(buildAccount()) },
    });

    await expect(service.getById('account-1')).resolves.toMatchObject({ id: 'account-1' });
  });

  it('throws when the account no longer exists', async () => {
    const { service } = buildService({});

    await expect(service.getById('missing')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
