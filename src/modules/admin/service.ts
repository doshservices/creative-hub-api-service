import type { AccountDTO, AccountPage, AccountType } from '../auth/index.js';
import type { CreativeProfileDTO, EmployerProfileDTO } from '../users/index.js';
import type {
  AdminAccountRowDTO,
  AdminEmployerRowDTO,
  AdminKycStatus,
  AdminRowPage,
  AdminSignupsByDayDTO,
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

// One call per accountType — mirrors how AccountReaderPort.count is already called once per
// accountType in getStats below, rather than a single unfiltered call the service would then
// have to split by type itself (the underlying aggregation has no cheaper way to return a
// per-type breakdown for a single day bucket).
export interface SignupsReaderPort {
  getSignupsByDay(params: {
    from: Date;
    to: Date;
    accountType: AccountType;
  }): Promise<Array<{ date: string; count: number }>>;
}

export interface LedgerVolumeReaderPort {
  getLedgerVolumeByType(params: { from: Date; to: Date }): Promise<Record<string, number>>;
}

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface StatsParams {
  days: number;
}

export const DEFAULT_STATS_DAYS = 30;
export const MAX_STATS_DAYS = 90;

// Full UTC calendar days ending today (inclusive) — `days: 1` means "just today", `days: 30`
// (the default) means today plus the 29 days before it. Matches the day-bucket format
// ($dateToString '%Y-%m-%d') the auth/wallet aggregations group by.
function statsDateRange(days: number): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  from.setUTCHours(0, 0, 0, 0);
  return { from, to };
}

// Merges the two per-accountType day-bucket arrays into one row per date — a date present in
// only one of the two (e.g. a day with talent signups but no employer signups) still gets a row,
// with the missing side at 0, never a dropped date.
function mergeSignupsByDay(
  talentRows: Array<{ date: string; count: number }>,
  employerRows: Array<{ date: string; count: number }>,
): AdminSignupsByDayDTO[] {
  const byDate = new Map<string, AdminSignupsByDayDTO>();
  for (const row of talentRows) {
    byDate.set(row.date, { date: row.date, talents: row.count, employers: 0 });
  }
  for (const row of employerRows) {
    const existing = byDate.get(row.date);
    byDate.set(row.date, { date: row.date, talents: existing?.talents ?? 0, employers: row.count });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
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
    private readonly signups: SignupsReaderPort,
    private readonly ledgerVolume: LedgerVolumeReaderPort,
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

  // Each figure sourced from one cheap, already-existing (or newly added) owning-module read,
  // bounded to a fixed number of queries regardless of the day range — never a per-day loop.
  // `signupsByDay`/`ledgerVolumeByType` are windowed to the last `params.days` UTC calendar days
  // (inclusive of today); the non-timeseries figures (`totalTalents`, etc.) stay all-time, same
  // as before this method took a params argument.
  async getStats(params: StatsParams = { days: DEFAULT_STATS_DAYS }): Promise<AdminStatsDTO> {
    const { from, to } = statsDateRange(params.days);
    const [totalTalents, totalEmployers, listingStats, talentSignups, employerSignups, ledgerVolumeByType] =
      await Promise.all([
        this.accounts.count('creative'),
        this.accounts.count('client'),
        this.listingStats.getPlatformListingStats(),
        this.signups.getSignupsByDay({ from, to, accountType: 'creative' }),
        this.signups.getSignupsByDay({ from, to, accountType: 'client' }),
        this.ledgerVolume.getLedgerVolumeByType({ from, to }),
      ]);
    return {
      totalTalents,
      totalEmployers,
      activeListings: listingStats.activeCount,
      listingsByCategory: listingStats.byCategory,
      signupsByDay: mergeSignupsByDay(talentSignups, employerSignups),
      ledgerVolumeByType,
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
