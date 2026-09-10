import type { AccountDTO, AccountPage, AccountType } from '../auth/index.js';
import type { CreativeProfileDTO, EmployerProfileDTO } from '../users/index.js';
import type {
  AdminAccountRowDTO,
  AdminEmployerRowDTO,
  AdminKycStatus,
  AdminRowPage,
  AdminStatsDTO,
  AdminTalentRowDTO,
  AdminWalletBalanceDTO,
} from './dto.js';

export interface AccountReaderPort {
  list(params: { accountType?: AccountType; limit: number; cursor?: string }): Promise<AccountPage>;
  count(accountType?: AccountType): Promise<number>;
}

export interface CreativeProfileReaderPort {
  getManyByAccountIds(accountIds: string[]): Promise<CreativeProfileDTO[]>;
}

export interface EmployerProfileReaderPort {
  getEmployerProfilesByAccountIds(accountIds: string[]): Promise<EmployerProfileDTO[]>;
}

export interface KycStatusReaderPort {
  getStatusesByAccountIds(
    accountIds: string[],
  ): Promise<Array<{ accountId: string; status: AdminKycStatus }>>;
}

export interface WalletBalanceReaderPort {
  getBalancesByAccountIds(accountIds: string[]): Promise<Record<string, AdminWalletBalanceDTO>>;
}

export interface ListingStatsReaderPort {
  getPlatformListingStats(): Promise<{ activeCount: number; byCategory: Record<string, number> }>;
}

export interface PageParams {
  limit: number;
  cursor?: string;
}

// Composes one page of accounts (the primary, driving query) with three batch lookups run in
// parallel — bounded to 1 + 3 queries regardless of page size, never one lookup per row. Missing
// profile/KYC/wallet data for a given accountId lands as `null` in that row, not a dropped row or
// a thrown error — an account that registered but never finished a profile is exactly the case
// this admin view exists to surface, not hide.
async function stitchBatchLookups(
  accounts: AccountDTO[],
  kyc: KycStatusReaderPort,
  wallets: WalletBalanceReaderPort,
): Promise<{
  kycByAccountId: Map<string, AdminKycStatus>;
  walletByAccountId: Map<string, AdminWalletBalanceDTO>;
}> {
  const accountIds = accounts.map((account) => account.id);
  const [kycStatuses, balances] = await Promise.all([
    kyc.getStatusesByAccountIds(accountIds),
    wallets.getBalancesByAccountIds(accountIds),
  ]);
  return {
    kycByAccountId: new Map(kycStatuses.map((row) => [row.accountId, row.status])),
    walletByAccountId: new Map(Object.entries(balances)),
  };
}

export class AdminService {
  constructor(
    private readonly accounts: AccountReaderPort,
    private readonly creativeProfiles: CreativeProfileReaderPort,
    private readonly employerProfiles: EmployerProfileReaderPort,
    private readonly kyc: KycStatusReaderPort,
    private readonly wallets: WalletBalanceReaderPort,
    private readonly listingStats: ListingStatsReaderPort,
  ) {}

  // Deliberately `auth.list`, not a `users` profile list, as the driving query: an account that
  // registered but never filled in a creative profile still shows up here rather than silently
  // vanishing — see the module's plan doc.
  async listTalents(params: PageParams): Promise<AdminRowPage<AdminTalentRowDTO>> {
    const page = await this.accounts.list({ accountType: 'creative', ...params });
    const accountIds = page.items.map((account) => account.id);
    const [profiles, { kycByAccountId, walletByAccountId }] = await Promise.all([
      this.creativeProfiles.getManyByAccountIds(accountIds),
      stitchBatchLookups(page.items, this.kyc, this.wallets),
    ]);
    const profileByAccountId = new Map(profiles.map((profile) => [profile.accountId, profile]));

    const items = page.items.map((account) => ({
      ...toRowBase(account, kycByAccountId, walletByAccountId),
      profile: profileByAccountId.get(account.id) ?? null,
    }));
    return { items, nextCursor: page.nextCursor };
  }

  async listEmployers(params: PageParams): Promise<AdminRowPage<AdminEmployerRowDTO>> {
    const page = await this.accounts.list({ accountType: 'client', ...params });
    const [profiles, { kycByAccountId, walletByAccountId }] = await Promise.all([
      this.employerProfiles.getEmployerProfilesByAccountIds(page.items.map((account) => account.id)),
      stitchBatchLookups(page.items, this.kyc, this.wallets),
    ]);
    const profileByAccountId = new Map(profiles.map((profile) => [profile.accountId, profile]));

    const items = page.items.map((account) => ({
      ...toRowBase(account, kycByAccountId, walletByAccountId),
      profile: profileByAccountId.get(account.id) ?? null,
    }));
    return { items, nextCursor: page.nextCursor };
  }

  // Scoped to figures each sourced from one cheap, already-existing owning-module read — see the
  // module's report for what was deliberately left out (signups-over-time, transaction volume)
  // and why.
  async getStats(): Promise<AdminStatsDTO> {
    const [totalTalents, totalEmployers, listingStats] = await Promise.all([
      this.accounts.count('creative'),
      this.accounts.count('client'),
      this.listingStats.getPlatformListingStats(),
    ]);
    return {
      totalTalents,
      totalEmployers,
      activeListings: listingStats.activeCount,
      listingsByCategory: listingStats.byCategory,
    };
  }
}

function toRowBase(
  account: AccountDTO,
  kycByAccountId: Map<string, AdminKycStatus>,
  walletByAccountId: Map<string, AdminWalletBalanceDTO>,
): AdminAccountRowDTO {
  return {
    accountId: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    accountType: account.accountType,
    status: account.status,
    createdAt: account.createdAt,
    kycStatus: kycByAccountId.get(account.id) ?? null,
    wallet: walletByAccountId.get(account.id) ?? null,
  };
}
