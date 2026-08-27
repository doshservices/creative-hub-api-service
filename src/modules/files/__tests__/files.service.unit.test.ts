import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../../common/errors.js';
import { FileService } from '../service.js';
import type { DownloadUrlSignerPort, FileRepositoryPort, UploadUrlSignerPort } from '../service.js';
import type { FileRecordDTO } from '../dto.js';

function buildRecord(overrides: Partial<FileRecordDTO> = {}): FileRecordDTO {
  return {
    id: 'file-1',
    ownerId: 'account-1',
    key: 'portfolio/account-1/uuid',
    purpose: 'portfolio',
    contentType: 'image/png',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  repository?: Partial<FileRepositoryPort>;
  uploadSigner?: Partial<UploadUrlSignerPort>;
  downloadSigner?: Partial<DownloadUrlSignerPort>;
} = {}) {
  const repository: FileRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildRecord()),
    findById: vi.fn().mockResolvedValue(buildRecord()),
    listForOwner: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    markConfirmed: vi.fn().mockResolvedValue(buildRecord({ status: 'confirmed' })),
    ...overrides.repository,
  };
  const uploadSigner: UploadUrlSignerPort = {
    createPresignedPutUrl: vi.fn().mockResolvedValue('https://s3.example.com/put'),
    ...overrides.uploadSigner,
  };
  const downloadSigner: DownloadUrlSignerPort = {
    createPresignedGetUrl: vi.fn().mockResolvedValue('https://s3.example.com/get'),
    ...overrides.downloadSigner,
  };

  const service = new FileService(repository, uploadSigner, downloadSigner);
  return { service, repository, uploadSigner, downloadSigner };
}

describe('FileService.createUploadUrl', () => {
  it('creates a pending file record and returns a signed put url', async () => {
    const { service, repository, uploadSigner } = buildService();

    const result = await service.createUploadUrl('account-1', {
      purpose: 'portfolio',
      contentType: 'image/png',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'account-1', purpose: 'portfolio', contentType: 'image/png' }),
    );
    expect(uploadSigner.createPresignedPutUrl).toHaveBeenCalledWith(
      expect.stringContaining('portfolio/account-1/'),
      'image/png',
    );
    expect(result.uploadUrl).toBe('https://s3.example.com/put');
  });
});

describe('FileService ownership checks', () => {
  it('throws NotFoundError for a missing file', async () => {
    const { service } = buildService({ repository: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(service.getMyFile('account-1', 'file-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ForbiddenError for another account's file", async () => {
    const { service } = buildService();
    await expect(service.getMyFile('someone-else', 'file-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects confirming a file owned by someone else', async () => {
    const { service } = buildService();
    await expect(service.confirmUpload('someone-else', 'file-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects generating a download url for a file owned by someone else', async () => {
    const { service } = buildService();
    await expect(service.createDownloadUrl('someone-else', 'file-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('FileService.confirmUpload', () => {
  it('marks the file confirmed', async () => {
    const { service, repository } = buildService();
    const result = await service.confirmUpload('account-1', 'file-1');
    expect(repository.markConfirmed).toHaveBeenCalledWith('file-1');
    expect(result.status).toBe('confirmed');
  });

  it('is idempotent once already confirmed', async () => {
    const { service, repository } = buildService({
      repository: { findById: vi.fn().mockResolvedValue(buildRecord({ status: 'confirmed' })) },
    });
    await service.confirmUpload('account-1', 'file-1');
    expect(repository.markConfirmed).not.toHaveBeenCalled();
  });
});

describe('FileService.createDownloadUrl', () => {
  it('signs a GET url for the stored key without persisting it', async () => {
    const { service, downloadSigner } = buildService();
    const result = await service.createDownloadUrl('account-1', 'file-1');
    expect(downloadSigner.createPresignedGetUrl).toHaveBeenCalledWith('portfolio/account-1/uuid');
    expect(result.downloadUrl).toBe('https://s3.example.com/get');
  });
});
