import { describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors.js';
import type { ApplicationDTO, ContractDTO } from '../dto.js';
import { HiringService } from '../service.js';
import type {
  ApplicationRepositoryPort,
  AuditRecorderPort,
  ContractRepositoryPort,
  ListingReaderPort,
} from '../service.js';

function buildApplication(overrides: Partial<ApplicationDTO> = {}): ApplicationDTO {
  return {
    id: 'application-1',
    listingId: 'listing-1',
    clientAccountId: 'client-1',
    creativeAccountId: 'creative-1',
    status: 'pending',
    message: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildContract(overrides: Partial<ContractDTO> = {}): ContractDTO {
  return {
    id: 'contract-1',
    listingId: 'listing-1',
    applicationId: 'application-1',
    clientAccountId: 'client-1',
    creativeAccountId: 'creative-1',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  applications?: Partial<ApplicationRepositoryPort>;
  contracts?: Partial<ContractRepositoryPort>;
  listings?: Partial<ListingReaderPort>;
  audit?: Partial<AuditRecorderPort>;
}) {
  const applications: ApplicationRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildApplication()),
    findById: vi.fn().mockResolvedValue(buildApplication()),
    findByListingAndCreative: vi.fn().mockResolvedValue(null),
    listByCreative: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    listByListing: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    updateStatus: vi.fn().mockResolvedValue(buildApplication({ status: 'accepted' })),
    ...overrides.applications,
  };
  const contracts: ContractRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildContract()),
    listForAccount: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    ...overrides.contracts,
  };
  const listings: ListingReaderPort = {
    findById: vi
      .fn()
      .mockResolvedValue({ id: 'listing-1', clientAccountId: 'client-1', status: 'open' }),
    ...overrides.listings,
  };
  const audit: AuditRecorderPort = {
    record: vi.fn().mockResolvedValue(undefined),
    ...overrides.audit,
  };

  const service = new HiringService(applications, contracts, listings, audit);
  return { service, applications, contracts, listings, audit };
}

describe('HiringService.apply', () => {
  it('creates an application against an open listing', async () => {
    const { service, applications } = buildService({});

    await service.apply('creative-1', { listingId: 'listing-1' });

    expect(applications.create).toHaveBeenCalledWith({
      listingId: 'listing-1',
      clientAccountId: 'client-1',
      creativeAccountId: 'creative-1',
    });
  });

  it('rejects when the listing does not exist', async () => {
    const { service } = buildService({ listings: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.apply('creative-1', { listingId: 'missing' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('rejects when the listing is closed', async () => {
    const { service } = buildService({
      listings: {
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'listing-1', clientAccountId: 'client-1', status: 'closed' }),
      },
    });

    await expect(service.apply('creative-1', { listingId: 'listing-1' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('rejects a duplicate application to the same listing', async () => {
    const { service } = buildService({
      applications: { findByListingAndCreative: vi.fn().mockResolvedValue(buildApplication()) },
    });

    await expect(service.apply('creative-1', { listingId: 'listing-1' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('HiringService.listApplicationsForListing', () => {
  it('rejects a client who does not own the listing', async () => {
    const { service } = buildService({
      listings: {
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'listing-1', clientAccountId: 'someone-else', status: 'open' }),
      },
    });

    await expect(
      service.listApplicationsForListing('client-1', 'listing-1', { limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('HiringService.updateApplicationStatus', () => {
  it('rejects a client who does not own the application', async () => {
    const { service } = buildService({
      applications: {
        findById: vi.fn().mockResolvedValue(buildApplication({ clientAccountId: 'someone-else' })),
      },
    });

    await expect(
      service.updateApplicationStatus('client-1', 'application-1', 'accepted'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects updating an application that already reached a final decision', async () => {
    const { service } = buildService({
      applications: {
        findById: vi.fn().mockResolvedValue(buildApplication({ status: 'accepted' })),
      },
    });

    await expect(
      service.updateApplicationStatus('client-1', 'application-1', 'rejected'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('creates a contract and records an audit entry when accepted', async () => {
    const { service, contracts, audit } = buildService({});

    await service.updateApplicationStatus('client-1', 'application-1', 'accepted');

    expect(contracts.create).toHaveBeenCalledWith({
      listingId: 'listing-1',
      applicationId: 'application-1',
      clientAccountId: 'client-1',
      creativeAccountId: 'creative-1',
    });
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'client-1',
      action: 'hiring.contract_created',
      targetType: 'contract',
      targetId: 'contract-1',
    });
  });

  it('does not create a contract when the status is not accepted', async () => {
    const { service, contracts, audit } = buildService({
      applications: {
        updateStatus: vi
          .fn()
          .mockResolvedValue(buildApplication({ status: 'interview_requested' })),
      },
    });

    await service.updateApplicationStatus('client-1', 'application-1', 'interview_requested');

    expect(contracts.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
