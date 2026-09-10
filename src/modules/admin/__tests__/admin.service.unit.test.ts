import { describe, expect, it, vi } from 'vitest';
import type { AccountDTO } from '../../auth/index.js';
import type { CreativeProfileDTO, EmployerProfileDTO } from '../../users/index.js';
import { AdminService } from '../service.js';
import type {
  AccountReaderPort,
  CreativeProfileReaderPort,
  EmployerProfileReaderPort,
  KycStatusReaderPort,
  ListingStatsReaderPort,
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

  const service = new AdminService(
    accounts,
    creativeProfiles,
    employerProfiles,
    kyc,
    wallets,
    listingStats,
  );
  return { service, accounts, creativeProfiles, employerProfiles, kyc, wallets, listingStats };
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
  it('composes counts and listing stats from each owning source', async () => {
    const { service, accounts, listingStats } = buildService({
      accounts: {
        count: vi.fn().mockImplementation((accountType?: string) =>
          Promise.resolve(accountType === 'creative' ? 42 : 7),
        ),
      },
    });

    const stats = await service.getStats();

    expect(accounts.count).toHaveBeenCalledWith('creative');
    expect(accounts.count).toHaveBeenCalledWith('client');
    expect(listingStats.getPlatformListingStats).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({
      totalTalents: 42,
      totalEmployers: 7,
      activeListings: 3,
      listingsByCategory: { dance: 3 },
    });
  });
});
