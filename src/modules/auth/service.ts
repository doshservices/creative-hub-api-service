import { randomBytes } from 'node:crypto';
import { ConflictError, UnauthorizedError } from '../../common/errors.js';
import { PERMISSIONS } from '../../common/permissions.js';
import type { AccountDTO, AuthTokensDTO } from './dto.js';
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
}

// 'creative' accounts get hired (own a profile, apply to listings, submit KYC); 'client'
// accounts hire (post and manage listings). Each grant maps to a route that actually checks it
// today.
function defaultPermissionsFor(accountType: AccountType): string[] {
  return accountType === 'creative'
    ? [PERMISSIONS.CREATIVE_PROFILE_WRITE, PERMISSIONS.HIRING_APPLY, PERMISSIONS.IDENTITY_VERIFY]
    : [PERMISSIONS.LISTINGS_WRITE];
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
