import type { AccountType } from '../auth/index.js';
import type { CreativeProfileDTO, EmployerProfileDTO } from '../users/index.js';

// Mirrors identity's KycStatus ('pending' | 'approved' | 'rejected' | 'failed') — not imported
// directly since identity/index.ts doesn't export the type, and this module only reads through
// index.ts per CLAUDE.md's cross-module rule. Widened to `string` here rather than duplicating a
// union that could drift; the wire value always comes straight from identity's own DTO.
export type AdminKycStatus = string;

export interface AdminWalletBalanceDTO {
  balanceMinor: number;
  heldMinor: number;
  currency: string;
}

// One row of the Manage Talents / Manage Employers tables — an `auth` account stitched with
// whatever a `users`/`identity`/`wallet` batch lookup found for that accountId. A missing
// profile/KYC-status/wallet record is `null`, never an error and never a dropped row — see
// admin/service.ts.
export interface AdminAccountRowDTO {
  accountId: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  status: 'active' | 'suspended';
  createdAt: Date;
  kycStatus: AdminKycStatus | null;
  wallet: AdminWalletBalanceDTO | null;
}

export interface AdminTalentRowDTO extends AdminAccountRowDTO {
  profile: CreativeProfileDTO | null;
}

export interface AdminEmployerRowDTO extends AdminAccountRowDTO {
  profile: EmployerProfileDTO | null;
}

export interface AdminRowPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AdminSignupsByDayDTO {
  date: string;
  talents: number;
  employers: number;
}

export interface AdminStatsDTO {
  totalTalents: number;
  totalEmployers: number;
  activeListings: number;
  listingsByCategory: Record<string, number>;
  // Both timeseries figures are scoped to the same `?days=` window (default 30, max 90) — see
  // admin/service.ts's getStats and the module's report for why ledger-entry-type volume, not a
  // listing-category volume, is what's shipped here.
  signupsByDay: AdminSignupsByDayDTO[];
  ledgerVolumeByType: Record<string, number>;
}
