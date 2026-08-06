import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../common/errors.js';
import type { CreativeProfileDTO } from '../dto.js';
import { CreativeProfileService } from '../service.js';
import type {
  CreativeProfileRepositoryPort,
  UploadUrlSignerPort,
  UpsertCreativeProfileInput,
} from '../service.js';

function buildProfile(overrides: Partial<CreativeProfileDTO> = {}): CreativeProfileDTO {
  return {
    id: 'profile-1',
    accountId: 'account-1',
    primaryRole: 'Dancer',
    bio: null,
    profilePhotoKey: null,
    skills: ['Contemporary Dance'],
    yearsOfExperience: null,
    previousWorkExperience: null,
    portfolioFileKey: null,
    availableDays: [],
    availableToTravel: null,
    hourlyRateBand: null,
    projectRateBand: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  repository?: Partial<CreativeProfileRepositoryPort>;
  uploadSigner?: Partial<UploadUrlSignerPort>;
}) {
  const repository: CreativeProfileRepositoryPort = {
    upsertForAccount: vi.fn().mockResolvedValue(buildProfile()),
    findByAccountId: vi.fn().mockResolvedValue(null),
    ...overrides.repository,
  };
  const uploadSigner: UploadUrlSignerPort = {
    createPresignedPutUrl: vi.fn().mockResolvedValue('https://s3.example.com/signed'),
    ...overrides.uploadSigner,
  };

  const service = new CreativeProfileService(repository, uploadSigner);
  return { service, repository, uploadSigner };
}

const minimalInput: UpsertCreativeProfileInput = {
  primaryRole: 'Dancer',
  skills: ['Contemporary Dance'],
};

describe('CreativeProfileService.upsertOwnProfile', () => {
  it('delegates to the repository with the caller-derived accountId', async () => {
    const { service, repository } = buildService({});

    await service.upsertOwnProfile('account-1', minimalInput);

    expect(repository.upsertForAccount).toHaveBeenCalledWith('account-1', minimalInput);
  });
});

describe('CreativeProfileService.getOwnProfile', () => {
  it('returns the profile when it exists', async () => {
    const { service } = buildService({
      repository: { findByAccountId: vi.fn().mockResolvedValue(buildProfile()) },
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

describe('CreativeProfileService.createUploadUrl', () => {
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
