import type { ObjectId } from 'mongodb';

// 'admin' is deliberately excluded from registerBodySchema's accountType enum — it's never
// publicly self-registerable. The first admin is created by scripts/bootstrap-admin.ts; every
// one after that via an existing admin calling POST /auth/admin/accounts. See
// defaultPermissionsFor in service.ts for what accountType:'admin' grants by default.
export type AccountType = 'client' | 'creative' | 'admin';

// `secret` is set only once 2FA is actually enabled (after the setup code is confirmed);
// `pendingSecret` holds a freshly generated secret between POST /auth/2fa/setup and the
// confirming POST /auth/2fa/enable, and is discarded either way once that resolves.
// `backupCodeHashes` are one-time-use, each removed from the array on redemption — see
// service.ts's disableTwoFactor/verifyTwoFactorLogin.
export interface TwoFactorState {
  enabled: boolean;
  secret: string | null;
  pendingSecret: string | null;
  backupCodeHashes: string[];
}

export interface AccountDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  permissions: string[];
  status: 'active' | 'suspended';
  twoFactor: TwoFactorState;
  createdAt: Date;
  updatedAt: Date;
}

// The application-level uniqueness check in the service prevents most races on signup; this
// index prevents all of them.
export const accountIndexes = [{ key: { email: 1 }, name: 'email_unique', unique: true }] as const;
