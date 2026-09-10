import { randomBytes } from 'node:crypto';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../common/errors.js';
import { PERMISSIONS } from '../../common/permissions.js';
import type { AccountDTO, AccountPage, AuthTokensDTO } from './dto.js';
import type { AccountType } from './model.js';
import { hashPassword, verifyPassword } from './password.js';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
}

export interface AccountRepositoryPort {
  findByEmailWithCredentials(
    email: string,
  ): Promise<(AccountDTO & { passwordHash: string }) | null>;
  create(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    accountType: AccountType;
    permissions: string[];
  }): Promise<AccountDTO>;
  findById(id: string): Promise<AccountDTO | null>;
  findCredentialsById(id: string): Promise<{ id: string; passwordHash: string } | null>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  updateStatus(id: string, status: 'active' | 'suspended'): Promise<AccountDTO | null>;
  findManyByIds(ids: string[]): Promise<AccountDTO[]>;
  list(params: { accountType?: AccountType; limit: number; cursor?: string }): Promise<AccountPage>;
}

// 'creative' accounts get hired (own a profile, apply to listings, submit KYC); 'client'
// accounts hire (post and manage listings). Each grant maps to a route that actually checks it
// today.
function defaultPermissionsFor(accountType: AccountType): string[] {
  return accountType === 'creative'
    ? [
        PERMISSIONS.CREATIVE_PROFILE_WRITE,
        PERMISSIONS.HIRING_APPLY,
        PERMISSIONS.IDENTITY_VERIFY,
        PERMISSIONS.PAYMENTS_INITIATE,
        PERMISSIONS.FILES_UPLOAD,
        PERMISSIONS.COLLABORATION_SUBMIT,
        PERMISSIONS.REVIEWS_SUBMIT,
      ]
    : [
        PERMISSIONS.LISTINGS_WRITE,
        PERMISSIONS.PAYMENTS_INITIATE,
        PERMISSIONS.FILES_UPLOAD,
        PERMISSIONS.COLLABORATION_REVIEW,
        PERMISSIONS.EMPLOYER_PROFILE_WRITE,
        PERMISSIONS.EVENTS_WRITE,
        PERMISSIONS.REVIEWS_SUBMIT,
      ];
}

export interface RefreshTokenStorePort {
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

export interface TokenSignerPort {
  sign(payload: { sub: string; permissions: string[] }): string;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
}

export interface AuthServiceOptions {
  accessTtl: string;
  refreshTtlSeconds: number;
}

const REFRESH_KEY_PREFIX = 'auth:refresh:';

export class AuthService {
  constructor(
    private readonly repository: AccountRepositoryPort,
    private readonly refreshTokens: RefreshTokenStorePort,
    private readonly signer: TokenSignerPort,
    private readonly audit: AuditRecorderPort,
    private readonly options: AuthServiceOptions,
  ) {}

  async register(input: RegisterInput): Promise<AuthTokensDTO> {
    const existing = await this.repository.findByEmailWithCredentials(input.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }
    const passwordHash = await hashPassword(input.password);
    const account = await this.repository.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      accountType: input.accountType,
      permissions: defaultPermissionsFor(input.accountType),
    });
    return this.issueTokens(account);
  }

  async login(email: string, password: string): Promise<AuthTokensDTO> {
    const account = await this.repository.findByEmailWithCredentials(email);
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = await this.issueTokens(account);
    await this.audit.record({
      actorId: account.id,
      action: 'auth.login',
      targetType: 'account',
      targetId: account.id,
    });
    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokensDTO> {
    const key = REFRESH_KEY_PREFIX + refreshToken;
    const accountId = await this.refreshTokens.get(key);
    if (!accountId) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    await this.refreshTokens.del(key);

    const account = await this.repository.findById(accountId);
    if (!account) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    return this.issueTokens(account);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.del(REFRESH_KEY_PREFIX + refreshToken);
  }

  async getById(accountId: string): Promise<AccountDTO> {
    const account = await this.repository.findById(accountId);
    if (!account) {
      throw new UnauthorizedError('Account no longer exists');
    }
    return account;
  }

  // Password change is explicitly audit-required per CLAUDE.md. Full 2FA is not implemented —
  // out of scope, see the implementation plan doc.
  async changePassword(
    accountId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const account = await this.repository.findCredentialsById(accountId);
    if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    const passwordHash = await hashPassword(newPassword);
    await this.repository.updatePasswordHash(accountId, passwordHash);
    await this.audit.record({
      actorId: accountId,
      action: 'auth.password_changed',
      targetType: 'account',
      targetId: accountId,
    });
  }

  // Admin actions below — status/role change is audit-required per CLAUDE.md. actorId is the
  // administering account, not the account being acted on.
  async suspendAccount(actorId: string, accountId: string): Promise<AccountDTO> {
    const updated = await this.repository.updateStatus(accountId, 'suspended');
    if (!updated) {
      throw new NotFoundError('Account not found');
    }
    await this.audit.record({
      actorId,
      action: 'auth.account_suspended',
      targetType: 'account',
      targetId: accountId,
    });
    return updated;
  }

  async reactivateAccount(actorId: string, accountId: string): Promise<AccountDTO> {
    const updated = await this.repository.updateStatus(accountId, 'active');
    if (!updated) {
      throw new NotFoundError('Account not found');
    }
    await this.audit.record({
      actorId,
      action: 'auth.account_reactivated',
      targetType: 'account',
      targetId: accountId,
    });
    return updated;
  }

  // Batch/paginated reads for the future admin composition module — not audit-required (reads,
  // not mutations).
  async getAccountsByIds(accountIds: string[]): Promise<AccountDTO[]> {
    return this.repository.findManyByIds(accountIds);
  }

  async listAccounts(params: {
    accountType?: AccountType;
    limit: number;
    cursor?: string;
  }): Promise<AccountPage> {
    return this.repository.list(params);
  }

  private async issueTokens(account: AccountDTO): Promise<AuthTokensDTO> {
    const accessToken = this.signer.sign({ sub: account.id, permissions: account.permissions });
    const refreshToken = randomBytes(32).toString('hex');
    await this.refreshTokens.set(
      REFRESH_KEY_PREFIX + refreshToken,
      account.id,
      'EX',
      this.options.refreshTtlSeconds,
    );
    return { accessToken, refreshToken, expiresIn: this.options.accessTtl };
  }
}
