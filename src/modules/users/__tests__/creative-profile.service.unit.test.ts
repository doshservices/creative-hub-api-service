import { describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors.js';
import type { CreativeProfileDTO, EmployerProfileDTO, PortfolioItemDTO } from '../dto.js';
import { UsersService } from '../service.js';
import type {
  AccountReaderPort,
  CreativeProfileRepositoryPort,
  EmployerProfileRepositoryPort,
  FileReaderPort,
  PortfolioItemRepositoryPort,
  UploadUrlSignerPort,
  UpsertCreativeProfileInput,
} from '../service.js';

function buildProfile(overrides: Partial<CreativeProfileDTO> = {}): CreativeProfileDTO {
  return {
    id: 'profile-1',
    accountId: 'account-1',
    primaryRole: 'Dancer',
    bio: null,
    location: null,
    profilePhotoKey: null,
    skills: ['Contemporary Dance'],
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

function buildPortfolioItem(overrides: Partial<PortfolioItemDTO> = {}): PortfolioItemDTO {
  return {
    id: 'item-1',
    accountId: 'account-1',
    fileId: 'file-1',
    mediaType: 'image',
    title: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  creativeProfiles?: Partial<CreativeProfileRepositoryPort>;
  portfolioItems?: Partial<PortfolioItemRepositoryPort>;
  employerProfiles?: Partial<EmployerProfileRepositoryPort>;
  files?: Partial<FileReaderPort>;
  accounts?: Partial<AccountReaderPort>;
  uploadSigner?: Partial<UploadUrlSignerPort>;
}) {
  const creativeProfiles: CreativeProfileRepositoryPort = {
    upsertForAccount: vi.fn().mockResolvedValue(buildProfile()),
    findByAccountId: vi.fn().mockResolvedValue(null),
    findPublicByAccountId: vi.fn().mockResolvedValue(null),
    findManyByAccountIds: vi.fn().mockResolvedValue([]),
    searchTalents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    incrementRating: vi.fn().mockResolvedValue(undefined),
    ...overrides.creativeProfiles,
  };
  const portfolioItems: PortfolioItemRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildPortfolioItem()),
    findById: vi.fn().mockResolvedValue(null),
    listForAccount: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    deleteById: vi.fn().mockResolvedValue(true),
    ...overrides.portfolioItems,
  };
  const employerProfiles: EmployerProfileRepositoryPort = {
    upsertForAccount: vi.fn().mockResolvedValue(buildEmployerProfile()),
    findByAccountId: vi.fn().mockResolvedValue(null),
    ...overrides.employerProfiles,
  };
  const files: FileReaderPort = {
    findById: vi.fn().mockResolvedValue({ id: 'file-1', ownerId: 'account-1', status: 'confirmed' }),
    ...overrides.files,
  };
  const accounts: AccountReaderPort = {
    findById: vi.fn().mockResolvedValue({ accountType: 'client' }),
    ...overrides.accounts,
  };
  const uploadSigner: UploadUrlSignerPort = {
    createPresignedPutUrl: vi.fn().mockResolvedValue('https://s3.example.com/signed'),
    ...overrides.uploadSigner,
  };

  const service = new UsersService(
    creativeProfiles,
    portfolioItems,
    employerProfiles,
    files,
    accounts,
    uploadSigner,
  );
  return { service, creativeProfiles, portfolioItems, employerProfiles, files, accounts, uploadSigner };
}

const minimalInput: UpsertCreativeProfileInput = {
  primaryRole: 'Dancer',
  skills: ['Contemporary Dance'],
};

describe('UsersService.upsertOwnProfile', () => {
  it('delegates to the repository with the caller-derived accountId', async () => {
    const { service, creativeProfiles } = buildService({});

    await service.upsertOwnProfile('account-1', minimalInput);

    expect(creativeProfiles.upsertForAccount).toHaveBeenCalledWith('account-1', minimalInput);
  });
});

describe('UsersService.getOwnProfile', () => {
  it('returns the profile when it exists', async () => {
    const { service } = buildService({
      creativeProfiles: { findByAccountId: vi.fn().mockResolvedValue(buildProfile()) },
    });

    await expect(service.getOwnProfile('account-1')).resolves.toMatchObject({
      accountId: 'account-1',
    });
  });

  it('throws NotFoundError when no profile exists yet', async () => {
    const { service } = buildService({});

    await expect(service.getOwnProfile('account-1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('UsersService.createUploadUrl', () => {
  it('namespaces the object key by purpose and accountId', async () => {
    const { service, uploadSigner } = buildService({});

    const result = await service.createUploadUrl('account-1', 'profile-photo', 'image/png');

    expect(result.key).toMatch(/^profile-photos\/account-1\//);
    expect(result.uploadUrl).toBe('https://s3.example.com/signed');
    expect(uploadSigner.createPresignedPutUrl).toHaveBeenCalledWith(result.key, 'image/png');
  });

  it('uses a different key prefix for portfolio uploads', async () => {
    const { service } = buildService({});

    const result = await service.createUploadUrl('account-1', 'portfolio', 'application/pdf');

    expect(result.key).toMatch(/^portfolio\/account-1\//);
  });
});

describe('UsersService.searchTalents / getPublicProfile', () => {
  it('delegates search filters and pagination straight through to the repository', async () => {
    const { service, creativeProfiles } = buildService({});

    await service.searchTalents({ category: 'Danc' }, { limit: 20 });

    expect(creativeProfiles.searchTalents).toHaveBeenCalledWith({ category: 'Danc' }, { limit: 20 });
  });

  it('throws NotFoundError when no public profile exists for the accountId', async () => {
    const { service } = buildService({});

    await expect(service.getPublicProfile('missing-account')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('UsersService.recordReviewRating', () => {
  it('increments the rating cache atomically via the repository', async () => {
    const { service, creativeProfiles } = buildService({});

    await service.recordReviewRating('account-2', 5);

    expect(creativeProfiles.incrementRating).toHaveBeenCalledWith('account-2', 5);
  });
});

describe('UsersService.addPortfolioItem', () => {
  it('inserts the item once the file is confirmed to belong to the caller', async () => {
    const { service, portfolioItems } = buildService({});

    await service.addPortfolioItem('account-1', { fileId: 'file-1', mediaType: 'image' });

    expect(portfolioItems.create).toHaveBeenCalledWith({
      accountId: 'account-1',
      fileId: 'file-1',
      mediaType: 'image',
    });
  });

  it('throws NotFoundError when the file does not exist', async () => {
    const { service } = buildService({ files: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(
      service.addPortfolioItem('account-1', { fileId: 'missing', mediaType: 'image' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ForbiddenError when the file belongs to a different account', async () => {
    const { service } = buildService({
      files: {
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'file-1', ownerId: 'someone-else', status: 'confirmed' }),
      },
    });

    await expect(
      service.addPortfolioItem('account-1', { fileId: 'file-1', mediaType: 'image' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws ConflictError when the file upload has not been confirmed', async () => {
    const { service } = buildService({
      files: {
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'file-1', ownerId: 'account-1', status: 'pending' }),
      },
    });

    await expect(
      service.addPortfolioItem('account-1', { fileId: 'file-1', mediaType: 'image' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('UsersService.deletePortfolioItem', () => {
  it('throws ForbiddenError when the caller does not own the item', async () => {
    const { service } = buildService({
      portfolioItems: {
        findById: vi.fn().mockResolvedValue(buildPortfolioItem({ accountId: 'someone-else' })),
      },
    });

    await expect(service.deletePortfolioItem('account-1', 'item-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('deletes the item when owned by the caller', async () => {
    const { service, portfolioItems } = buildService({
      portfolioItems: { findById: vi.fn().mockResolvedValue(buildPortfolioItem()) },
    });

    await service.deletePortfolioItem('account-1', 'item-1');

    expect(portfolioItems.deleteById).toHaveBeenCalledWith('item-1');
  });
});

describe('UsersService employer profile', () => {
  it('rejects a non-client account even if the loaded account is missing entirely', async () => {
    const { service } = buildService({ accounts: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.getOwnEmployerProfile('account-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects a creative account from upserting an employer profile', async () => {
    const { service } = buildService({
      accounts: { findById: vi.fn().mockResolvedValue({ accountType: 'creative' }) },
    });

    await expect(
      service.upsertOwnEmployerProfile('account-1', { companyName: 'Acme' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('upserts for a client account', async () => {
    const { service, employerProfiles } = buildService({});

    await service.upsertOwnEmployerProfile('account-1', { companyName: 'Acme' });

    expect(employerProfiles.upsertForAccount).toHaveBeenCalledWith('account-1', {
      companyName: 'Acme',
    });
  });

  it('throws NotFoundError for a client account with no profile yet', async () => {
    const { service } = buildService({});

    await expect(service.getOwnEmployerProfile('account-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
