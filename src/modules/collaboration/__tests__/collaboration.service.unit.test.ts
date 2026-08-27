import { describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors.js';
import { CollaborationService } from '../service.js';
import type { ContractReaderPort, DeliverableRepositoryPort, FileReaderPort } from '../service.js';
import type { DeliverableDTO } from '../dto.js';

function buildContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-1',
    clientAccountId: 'client-1',
    creativeAccountId: 'creative-1',
    status: 'active',
    ...overrides,
  };
}

function buildFile(overrides: Record<string, unknown> = {}) {
  return { id: 'file-1', ownerId: 'creative-1', status: 'confirmed', ...overrides };
}

function buildDeliverable(overrides: Partial<DeliverableDTO> = {}): DeliverableDTO {
  return {
    id: 'deliverable-1',
    contractId: 'contract-1',
    clientAccountId: 'client-1',
    creativeAccountId: 'creative-1',
    fileId: 'file-1',
    note: null,
    status: 'submitted',
    reviewNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  deliverables?: Partial<DeliverableRepositoryPort>;
  contracts?: Partial<ContractReaderPort>;
  files?: Partial<FileReaderPort>;
} = {}) {
  const deliverables: DeliverableRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildDeliverable()),
    findById: vi.fn().mockResolvedValue(buildDeliverable()),
    listForContract: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    updateReview: vi.fn().mockResolvedValue(buildDeliverable({ status: 'approved' })),
    ...overrides.deliverables,
  };
  const contracts: ContractReaderPort = {
    findById: vi.fn().mockResolvedValue(buildContract()),
    ...overrides.contracts,
  };
  const files: FileReaderPort = {
    findById: vi.fn().mockResolvedValue(buildFile()),
    ...overrides.files,
  };

  const service = new CollaborationService(deliverables, contracts, files);
  return { service, deliverables, contracts, files };
}

describe('CollaborationService.submitDeliverable', () => {
  it('throws NotFoundError when the contract does not exist', async () => {
    const { service } = buildService({ contracts: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.submitDeliverable('creative-1', 'contract-1', { fileId: 'file-1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a submitter who is not the creative on the contract', async () => {
    const { service } = buildService();
    await expect(
      service.submitDeliverable('someone-else', 'contract-1', { fileId: 'file-1' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects submitting against a non-active contract', async () => {
    const { service } = buildService({
      contracts: { findById: vi.fn().mockResolvedValue(buildContract({ status: 'completed' })) },
    });
    await expect(
      service.submitDeliverable('creative-1', 'contract-1', { fileId: 'file-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError when the file does not exist', async () => {
    const { service } = buildService({ files: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.submitDeliverable('creative-1', 'contract-1', { fileId: 'file-1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a file owned by a different account', async () => {
    const { service } = buildService({
      files: { findById: vi.fn().mockResolvedValue(buildFile({ ownerId: 'someone-else' })) },
    });
    await expect(
      service.submitDeliverable('creative-1', 'contract-1', { fileId: 'file-1' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects a file that has not been confirmed yet', async () => {
    const { service } = buildService({
      files: { findById: vi.fn().mockResolvedValue(buildFile({ status: 'pending' })) },
    });
    await expect(
      service.submitDeliverable('creative-1', 'contract-1', { fileId: 'file-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('creates the deliverable with the contract parties denormalized', async () => {
    const { service, deliverables } = buildService();
    await service.submitDeliverable('creative-1', 'contract-1', { fileId: 'file-1', note: 'v1' });
    expect(deliverables.create).toHaveBeenCalledWith({
      contractId: 'contract-1',
      clientAccountId: 'client-1',
      creativeAccountId: 'creative-1',
      fileId: 'file-1',
      note: 'v1',
    });
  });
});

describe('CollaborationService.listDeliverables', () => {
  it('rejects an account that is not a party to the contract', async () => {
    const { service } = buildService();
    await expect(
      service.listDeliverables('someone-else', 'contract-1', { limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows the client to list', async () => {
    const { service, deliverables } = buildService();
    await service.listDeliverables('client-1', 'contract-1', { limit: 20 });
    expect(deliverables.listForContract).toHaveBeenCalledWith('contract-1', { limit: 20 });
  });
});

describe('CollaborationService.getDeliverable', () => {
  it('rejects an account that is not a party to the deliverable', async () => {
    const { service } = buildService();
    await expect(service.getDeliverable('someone-else', 'deliverable-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('CollaborationService.reviewDeliverable', () => {
  it('rejects a reviewer who is not the client on the contract', async () => {
    const { service } = buildService();
    await expect(
      service.reviewDeliverable('someone-else', 'deliverable-1', { status: 'approved' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects reviewing a deliverable that is not in submitted status', async () => {
    const { service } = buildService({
      deliverables: {
        findById: vi.fn().mockResolvedValue(buildDeliverable({ status: 'approved' })),
      },
    });
    await expect(
      service.reviewDeliverable('client-1', 'deliverable-1', { status: 'approved' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('applies the review decision', async () => {
    const { service, deliverables } = buildService();
    const result = await service.reviewDeliverable('client-1', 'deliverable-1', {
      status: 'approved',
      reviewNote: 'looks great',
    });
    expect(deliverables.updateReview).toHaveBeenCalledWith(
      'deliverable-1',
      'approved',
      'looks great',
    );
    expect(result.status).toBe('approved');
  });
});
