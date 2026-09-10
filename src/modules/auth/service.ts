import { randomBytes } from 'node:crypto';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../common/errors.js';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  AccountDTO,
  AccountPage,
  AuthTokensDTO,
  TwoFactorChallengeDTO,
  TwoFactorEnabledDTO,
  TwoFactorSetupDTO,
} from './dto.js';
import type { AccountType, TwoFactorState } from './model.js';
import { hashPassword, verifyPassword } from './password.js';
import { buildOtpAuthUrl, generateBackupCodes, generateBase32Secret, verifyTotp } from './totp.js';

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
  findTwoFactorStateById(id: string): Promise<TwoFactorState | null>;
  setPendingTwoFactorSecret(id: string, pendingSecret: string): Promise<void>;
  activateTwoFactor(id: string, secret: string, backupCodeHashes: string[]): Promise<void>;
  deactivateTwoFactor(id: string): Promise<void>;
  removeBackupCodeHash(id: string, hash: string): Promise<void>;
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
const TWO_FACTOR_KEY_PREFIX = 'auth:2fa-challenge:';
// Long enough to type a 6-digit code, short enough that a leaked challenge token isn't useful
// for long — unlike a refresh token, this one only ever proves "already gave the right
// password," not "is this account," so it doesn't need refresh-token-length TTLs.
const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 300;

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

  async login(email: string, password: string): Promise<AuthTokensDTO | TwoFactorChallengeDTO> {
    const account = await this.repository.findByEmailWithCredentials(email);
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const twoFactor = await this.repository.findTwoFactorStateById(account.id);
    if (twoFactor?.enabled) {
      // No access/refresh token yet — those are only issued once verifyTwoFactorLogin confirms
      // a code. This challenge token is single-use and short-lived, stored in the same Redis
      // store as refresh tokens under a distinct key prefix.
      const twoFactorToken = randomBytes(32).toString('hex');
      await this.refreshTokens.set(
        TWO_FACTOR_KEY_PREFIX + twoFactorToken,
        account.id,
        'EX',
        TWO_FACTOR_CHALLENGE_TTL_SECONDS,
      );
      return { requiresTwoFactor: true, twoFactorToken };
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

  // Completes a login that login() deferred behind a 2FA challenge. The challenge token is
  // consumed on first use (or first failed attempt — no unlimited guessing against one token).
  async verifyTwoFactorLogin(twoFactorToken: string, code: string): Promise<AuthTokensDTO> {
    const key = TWO_FACTOR_KEY_PREFIX + twoFactorToken;
    const accountId = await this.refreshTokens.get(key);
    if (!accountId) {
      throw new UnauthorizedError('Invalid or expired two-factor challenge');
    }
    await this.refreshTokens.del(key);

    const twoFactor = await this.repository.findTwoFactorStateById(accountId);
    if (!twoFactor?.enabled || !(await this.verifyTwoFactorCode(accountId, twoFactor, code))) {
      throw new UnauthorizedError('Invalid two-factor code');
    }

    const account = await this.repository.findById(accountId);
    if (!account) {
      throw new UnauthorizedError('Account no longer exists');
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

  // Password change is explicitly audit-required per CLAUDE.md.
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

  // POST /auth/2fa/setup — generates a new secret and parks it as `pendingSecret` until
  // enableTwoFactor confirms the account actually has it loaded in an authenticator app.
  // Re-callable: calling setup again before enabling just replaces the pending secret, so an
  // abandoned setup attempt never locks the account out of trying again.
  async setupTwoFactor(accountId: string): Promise<TwoFactorSetupDTO> {
    const account = await this.repository.findById(accountId);
    if (!account) {
      throw new UnauthorizedError('Account no longer exists');
    }
    const secret = generateBase32Secret();
    await this.repository.setPendingTwoFactorSecret(accountId, secret);
    return { secret, otpauthUrl: buildOtpAuthUrl(secret, account.email) };
  }

  // POST /auth/2fa/enable — the one time backup codes are ever returned in plaintext.
  async enableTwoFactor(accountId: string, code: string): Promise<TwoFactorEnabledDTO> {
    const twoFactor = await this.repository.findTwoFactorStateById(accountId);
    if (!twoFactor?.pendingSecret) {
      throw new BadRequestError('Call POST /auth/2fa/setup before enabling two-factor auth');
    }
    if (!verifyTotp(twoFactor.pendingSecret, code)) {
      throw new UnauthorizedError('Invalid two-factor code');
    }

    const backupCodes = generateBackupCodes();
    const backupCodeHashes = await Promise.all(backupCodes.map((backupCode) => hashPassword(backupCode)));
    await this.repository.activateTwoFactor(accountId, twoFactor.pendingSecret, backupCodeHashes);
    await this.audit.record({
      actorId: accountId,
      action: 'auth.2fa_enabled',
      targetType: 'account',
      targetId: accountId,
    });
    return { backupCodes };
  }

  // POST /auth/2fa/disable — requires both the current password AND a valid code (TOTP or
  // backup), the same "re-prove who you are" bar as changePassword, since this is a security
  // downgrade rather than a routine self-service action.
  async disableTwoFactor(accountId: string, password: string, code: string): Promise<void> {
    const credentials = await this.repository.findCredentialsById(accountId);
    if (!credentials || !(await verifyPassword(password, credentials.passwordHash))) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    const twoFactor = await this.repository.findTwoFactorStateById(accountId);
    if (!twoFactor?.enabled || !(await this.verifyTwoFactorCode(accountId, twoFactor, code))) {
      throw new UnauthorizedError('Invalid two-factor code');
    }

    await this.repository.deactivateTwoFactor(accountId);
    await this.audit.record({
      actorId: accountId,
      action: 'auth.2fa_disabled',
      targetType: 'account',
      targetId: accountId,
    });
  }

  // Shared by verifyTwoFactorLogin and disableTwoFactor: a valid TOTP code always wins first;
  // otherwise fall back to checking (and, on match, consuming) a backup code. Backup-code hashes
  // aren't searchable by value the way a TOTP secret comparison is, so this checks each one in
  // turn — the list is short (single digits) by design, never large enough to matter.
  private async verifyTwoFactorCode(
    accountId: string,
    twoFactor: TwoFactorState,
    code: string,
  ): Promise<boolean> {
    if (twoFactor.secret && verifyTotp(twoFactor.secret, code)) {
      return true;
    }
    for (const hash of twoFactor.backupCodeHashes) {
      if (await verifyPassword(code, hash)) {
        await this.repository.removeBackupCodeHash(accountId, hash);
        return true;
      }
    }
    return false;
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
