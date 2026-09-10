import { describe, expect, it, vi } from 'vitest';
import type { AccountDTO } from '../../auth/index.js';
import type { CreativeProfileDTO, EmployerProfileDTO } from '../../users/index.js';
import { AdminService } from '../service.js';
import type {
  AccountReaderPort,
  CreativeProfileReaderPort,
  EmployerProfileReaderPort,
  KycStatusReaderPort,
  LedgerVolumeReaderPort,
  ListingStatsReaderPort,
  SignupsReaderPort,
  WalletBalanceReaderPort,
} from '../service.js';

function buildAccount(overrides: Partial<AccountDTO> = {}): AccountDTO {
  return {
    id: 'account-1',
    email: 'talent@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    accountType: 'creative',
    permissions: [],
    status: 'active',
    // Kept in sync with auth's AccountDTO shape (a concurrent change on this codebase added 2FA
    // state) — this fixture only cares about the fields admin's stitching logic reads.
    twoFactorEnabled: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildCreativeProfile(overrides: Partial<CreativeProfileDTO> = {}): CreativeProfileDTO {
  return {
    id: 'profile-1',
    accountId: 'account-1',
    primaryRole: 'Photographer',
    bio: null,
    location: null,
    profilePhotoKey: null,
    skills: [],
    yearsOfExperience: null,
    previousWorkExperience: null,
    portfolioFileKey: null,
    availableDays: [],
    availableToTravel: null,
    hourlyRateBand: null,
    projectRateBand: null,
    ratingAvg: null,
    ratingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildEmployerProfile(overrides: Partial<EmployerProfileDTO> = {}): EmployerProfileDTO {
  return {
    id: 'employer-profile-1',
    accountId: 'account-1',
    companyName: 'Acme Studios',
    industry: null,
    bio: null,
    logoFileKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  accounts?: Partial<AccountReaderPort>;
  creativeProfiles?: Partial<CreativeProfileReaderPort>;
  employerProfiles?: Partial<EmployerProfileReaderPort>;
  kyc?: Partial<KycStatusReaderPort>;
  wallets?: Partial<WalletBalanceReaderPort>;
  listingStats?: Partial<ListingStatsReaderPort>;
  signups?: Partial<SignupsReaderPort>;
  ledgerVolume?: Partial<LedgerVolumeReaderPort>;
}) {
  const accounts: AccountReaderPort = {
    list: vi.fn().mockResolvedValue({ items: [buildAccount()], nextCursor: null }),
    count: vi.fn().mockResolvedValue(0),
    ...overrides.accounts,
  };
  const creativeProfiles: CreativeProfileReaderPort = {
    getManyByAccountIds: vi.fn().mockResolvedValue([buildCreativeProfile()]),
    ...overrides.creativeProfiles,
  };
  const employerProfiles: EmployerProfileReaderPort = {
    getEmployerProfilesByAccountIds: vi.fn().mockResolvedValue([buildEmployerProfile()]),
    ...overrides.employerProfiles,
  };
  const kyc: KycStatusReaderPort = {
    getStatusesByAccountIds: vi.fn().mockResolvedValue([{ accountId: 'account-1', status: 'approved' }]),
    ...overrides.kyc,
  };
  const wallets: WalletBalanceReaderPort = {
    getBalancesByAccountIds: vi
      .fn()
      .mockResolvedValue({ 'account-1': { balanceMinor: 5000, heldMinor: 0, currency: 'NGN' } }),
    ...overrides.wallets,
  };
  const listingStats: ListingStatsReaderPort = {
    getPlatformListingStats: vi.fn().mockResolvedValue({ activeCount: 3, byCategory: { dance: 3 } }),
    ...overrides.listingStats,
  };
  const signups: SignupsReaderPort = {
    getSignupsByDay: vi
      .fn()
      .mockImplementation((params: { accountType: string }) =>
        Promise.resolve(
          params.accountType === 'creative'
            ? [{ date: '2026-01-01', count: 2 }]
            : [{ date: '2026-01-01', count: 1 }],
        ),
      ),
    ...overrides.signups,
  };
  const ledgerVolume: LedgerVolumeReaderPort = {
    getLedgerVolumeByType: vi.fn().mockResolvedValue({ credit: 10_000, debit: 4_000 }),
    ...overrides.ledgerVolume,
  };

  const service = new AdminService(
    accounts,
    creativeProfiles,
    employerProfiles,
    kyc,
    wallets,
    listingStats,
    signups,
    ledgerVolume,
  );
  return {
    service,
    accounts,
    creativeProfiles,
    employerProfiles,
    kyc,
    wallets,
    listingStats,
    signups,
    ledgerVolume,
  };
}

describe('AdminService.listTalents', () => {
  it('stitches account + profile + kyc + wallet by accountId when every batch lookup has a match', async () => {
    const { service } = buildService({});

    const page = await service.listTalents({ limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      accountId: 'account-1',
      email: 'talent@example.com',
      kycStatus: 'approved',
      wallet: { balanceMinor: 5000, heldMinor: 0, currency: 'NGN' },
      profile: expect.objectContaining({ primaryRole: 'Photographer' }),
    });
  });

  it('fills in null for a profile/KYC/wallet the batch lookups did not find — no thrown error, no dropped row', async () => {
    const { service } = buildService({
      creativeProfiles: { getManyByAccountIds: vi.fn().mockResolvedValue([]) },
      kyc: { getStatusesByAccountIds: vi.fn().mockResolvedValue([]) },
      wallets: { getBalancesByAccountIds: vi.fn().mockResolvedValue({}) },
    });

    const page = await service.listTalents({ limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      accountId: 'account-1',
      profile: null,
      kycStatus: null,
      wallet: null,
    });
  });

  it('drives the page from auth.list with accountType creative and passes the query through unchanged', async () => {
    const { service, accounts } = buildService({});

    await service.listTalents({ limit: 5, cursor: 'cursor-1' });

    expect(accounts.list).toHaveBeenCalledWith({ accountType: 'creative', limit: 5, cursor: 'cursor-1' });
    expect(accounts.list).toHaveBeenCalledTimes(1);
  });

  it('issues exactly one primary query and one batch call per port regardless of page size — no N+1', async () => {
    const threeAccounts = [
      buildAccount({ id: 'a1' }),
      buildAccount({ id: 'a2' }),
      buildAccount({ id: 'a3' }),
    ];
    const { service, accounts, creativeProfiles, kyc, wallets } = buildService({
      accounts: { list: vi.fn().mockResolvedValue({ items: threeAccounts, nextCursor: null }) },
    });

    await service.listTalents({ limit: 20 });

    expect(accounts.list).toHaveBeenCalledTimes(1);
    expect(creativeProfiles.getManyByAccountIds).toHaveBeenCalledTimes(1);
    expect(creativeProfiles.getManyByAccountIds).toHaveBeenCalledWith(['a1', 'a2', 'a3']);
    expect(kyc.getStatusesByAccountIds).toHaveBeenCalledTimes(1);
    expect(wallets.getBalancesByAccountIds).toHaveBeenCalledTimes(1);
  });

  it('propagates nextCursor from the primary account page', async () => {
    const { service } = buildService({
      accounts: {
        list: vi.fn().mockResolvedValue({ items: [buildAccount()], nextCursor: 'next-abc' }),
      },
    });

    const page = await service.listTalents({ limit: 20 });

    expect(page.nextCursor).toBe('next-abc');
  });
});

describe('AdminService.listEmployers', () => {
  it('drives the page from auth.list with accountType client and stitches the employer profile', async () => {
    const clientAccount = buildAccount({ accountType: 'client' });
    const { service, accounts, employerProfiles } = buildService({
      accounts: { list: vi.fn().mockResolvedValue({ items: [clientAccount], nextCursor: null }) },
    });

    const page = await service.listEmployers({ limit: 20 });

    expect(accounts.list).toHaveBeenCalledWith({ accountType: 'client', limit: 20 });
    expect(employerProfiles.getEmployerProfilesByAccountIds).toHaveBeenCalledWith(['account-1']);
    expect(page.items[0]).toMatchObject({
      accountId: 'account-1',
      profile: expect.objectContaining({ companyName: 'Acme Studios' }),
    });
  });

  it('fills in null for a missing employer profile', async () => {
    const clientAccount = buildAccount({ accountType: 'client' });
    const { service } = buildService({
      accounts: { list: vi.fn().mockResolvedValue({ items: [clientAccount], nextCursor: null }) },
      employerProfiles: { getEmployerProfilesByAccountIds: vi.fn().mockResolvedValue([]) },
    });

    const page = await service.listEmployers({ limit: 20 });

    expect(page.items[0]?.profile).toBeNull();
  });
});

describe('AdminService.getStats', () => {
  it('composes counts, listing stats, signups-by-day, and ledger volume from each owning source', async () => {
    const { service, accounts, listingStats, signups, ledgerVolume } = buildService({
      accounts: {
        count: vi.fn().mockImplementation((accountType?: string) =>
          Promise.resolve(accountType === 'creative' ? 42 : 7),
        ),
      },
    });

    const stats = await service.getStats({ days: 30 });

    expect(accounts.count).toHaveBeenCalledWith('creative');
    expect(accounts.count).toHaveBeenCalledWith('client');
    expect(listingStats.getPlatformListingStats).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({
      totalTalents: 42,
      totalEmployers: 7,
      activeListings: 3,
      listingsByCategory: { dance: 3 },
      signupsByDay: [{ date: '2026-01-01', talents: 2, employers: 1 }],
      ledgerVolumeByType: { credit: 10_000, debit: 4_000 },
    });
    expect(signups.getSignupsByDay).toHaveBeenCalledWith(
      expect.objectContaining({ accountType: 'creative' }),
    );
    expect(signups.getSignupsByDay).toHaveBeenCalledWith(
      expect.objectContaining({ accountType: 'client' }),
    );
    expect(ledgerVolume.getLedgerVolumeByType).toHaveBeenCalledTimes(1);
  });

  it('defaults to the last 30 days when no params are given', async () => {
    const { service, signups } = buildService({});

    await service.getStats();

    const calls = (signups.getSignupsByDay as ReturnType<typeof vi.fn>).mock.calls;
    const { from, to } = calls[0]?.[0] as { from: Date; to: Date };
    // 30 calendar days inclusive of both endpoints: `to` sits at day N's 23:59:59.999 and `from`
    // at day N-29's 00:00:00.000, a ~30-day span once the sub-day remainder is floored off.
    const spanDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    expect(spanDays).toBe(29);
    expect(to.getTime() - from.getTime()).toBeLessThan(30 * 24 * 60 * 60 * 1000);
  });

  it('issues a bounded number of calls per port regardless of the day range — no per-day loop', async () => {
    const { service, signups, ledgerVolume } = buildService({});

    await service.getStats({ days: 90 });

    // One call per accountType (creative, client) — not one call per day of the 90-day range.
    expect(signups.getSignupsByDay).toHaveBeenCalledTimes(2);
    expect(ledgerVolume.getLedgerVolumeByType).toHaveBeenCalledTimes(1);
  });

  it('merges signups-by-day so a date with only one accountType still gets a full row', async () => {
    const { service } = buildService({
      signups: {
        getSignupsByDay: vi
          .fn()
          .mockImplementation((params: { accountType: string }) =>
            Promise.resolve(
              params.accountType === 'creative' ? [{ date: '2026-02-01', count: 5 }] : [],
            ),
          ),
      },
    });

    const stats = await service.getStats({ days: 30 });

    expect(stats.signupsByDay).toEqual([{ date: '2026-02-01', talents: 5, employers: 0 }]);
  });
});
