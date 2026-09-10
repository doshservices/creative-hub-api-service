import type { AccountType } from './model.js';

export interface AccountDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  permissions: string[];
  status: 'active' | 'suspended';
  // Never the secret or backup codes — those never leave setup/enable's own one-time response.
  twoFactorEnabled: boolean;
  createdAt: Date;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// Returned by POST /auth/login instead of AuthTokensDTO when the account has 2FA enabled —
// no access/refresh token is issued until POST /auth/login/verify-2fa succeeds.
export interface TwoFactorChallengeDTO {
  requiresTwoFactor: true;
  twoFactorToken: string;
}

export interface TwoFactorSetupDTO {
  secret: string;
  otpauthUrl: string;
}

// Backup codes are shown exactly once, at the moment 2FA is enabled — never retrievable again.
export interface TwoFactorEnabledDTO {
  backupCodes: string[];
}

export interface AccountPage {
  items: AccountDTO[];
  nextCursor: string | null;
}
