import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../../common/errors.js';
import type { ListingDTO } from '../dto.js';
import type { AuditRecorderPort, CreateListingInput, ListingRepositoryPort } from '../service.js';
import { ListingService } from '../service.js';

function buildListing(overrides: Partial<ListingDTO> = {}): ListingDTO {
  return {
    id: 'listing-1',
    clientAccountId: 'client-1',
    title: 'Dance Crew Needed',
    description: 'Looking for dancers',
    location: 'Lagos, Nigeria',
    category: 'dance',
    headcount: 1,
    projectType: 'onsite',
    paymentType: 'fixed',
    budgetMinMinor: 8_000_000,
    budgetMaxMinor: 10_000_000,
    currency: 'NGN',
    duration: '3 days',
    status: 'open',
    moderation: { flagged: false, flaggedReason: null, flaggedAt: null },
    applicantCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: Partial<ListingRepositoryPort> = {}) {
  const repository: ListingRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildListing()),
    findById: vi.fn().mockResolvedValue(buildListing()),
    listPublic: vi.fn().mockResolvedValue({ items: [buildListing()], nextCursor: null }),
    listByClient: vi.fn().mockResolvedValue({ items: [buildListing()], nextCursor: null }),
    update: vi.fn().mockResolvedValue(buildListing()),
    close: vi.fn().mockResolvedValue(buildListing({ status: 'closed' })),
    flag: vi.fn().mockResolvedValue(buildListing({ moderation: { flagged: true, flaggedReason: 'spam', flaggedAt: new Date() } })),
    unflag: vi.fn().mockResolvedValue(buildListing()),
    adjustApplicantCount: vi.fn().mockResolvedValue(undefined),
    statsForClient: vi.fn().mockResolvedValue({ activeCount: 0, byCategory: {} }),
    ...overrides,
  };
  const audit: AuditRecorderPort = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new ListingService(repository, audit);
  return { service, repository, audit };
}

const minimalInput: CreateListingInput = {
  title: 'Dance Crew Needed',
  description: 'Looking for dancers',
  location: 'Lagos, Nigeria',
  category: 'dance',
  projectType: 'onsite',
  paymentType: 'fixed',
  budgetMinMinor: 8_000_000,
  budgetMaxMinor: 10_000_000,
  currency: 'NGN',
  duration: '3 days',
};

describe('ListingService.create', () => {
  it('creates a listing owned by the calling client', async () => {
    const { service, repository } = buildService();

    await service.create('client-1', minimalInput);

    expect(repository.create).toHaveBeenCalledWith({
      ...minimalInput,
      clientAccountId: 'client-1',
      headcount: 1,
      status: 'open',
    });
  });

  it('rejects a budget range where the max is below the min', async () => {
    const { service } = buildService();

    await expect(
      service.create('client-1', { ...minimalInput, budgetMinMinor: 10, budgetMaxMinor: 5 }),
    ).rejects.toThrow();
  });

  it('starts as a draft when publish is explicitly false', async () => {
    const { service, repository } = buildService();

    await service.create('client-1', { ...minimalInput, publish: false });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' }),
    );
  });
});

describe('ListingService.getById', () => {
  it('throws NotFoundError when the listing does not exist', async () => {
    const { service } = buildService({ findById: vi.fn().mockResolvedValue(null) });

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ListingService.update', () => {
  it('rejects editing a listing owned by a different client', async () => {
    const { service } = buildService({
      findById: vi.fn().mockResolvedValue(buildListing({ clientAccountId: 'someone-else' })),
    });

    await expect(service.update('client-1', 'listing-1', {})).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects editing a closed listing', async () => {
    const { service } = buildService({
      findById: vi.fn().mockResolvedValue(buildListing({ status: 'closed' })),
    });

    await expect(service.update('client-1', 'listing-1', { title: 'New title' })).rejects.toThrow();
  });
});

describe('ListingService.close', () => {
  it('closes the listing when the caller owns it', async () => {
    const { service, repository } = buildService({
      findById: vi.fn().mockResolvedValue(buildListing({ clientAccountId: 'client-1' })),
    });

    const result = await service.close('client-1', 'listing-1');

    expect(repository.close).toHaveBeenCalledWith('listing-1');
    expect(result.status).toBe('closed');
  });

  it('rejects closing a listing owned by a different client', async () => {
    const { service, repository } = buildService({
      findById: vi.fn().mockResolvedValue(buildListing({ clientAccountId: 'someone-else' })),
    });

    await expect(service.close('client-1', 'listing-1')).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.close).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the listing does not exist', async () => {
    const { service } = buildService({ findById: vi.fn().mockResolvedValue(null) });

    await expect(service.close('client-1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ListingService.adminClose', () => {
  it('closes any listing without an ownership check and writes an audit entry', async () => {
    const { service, repository, audit } = buildService();

    await service.adminClose('admin-1', 'listing-1');

    expect(repository.close).toHaveBeenCalledWith('listing-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'listings.admin_closed' }),
    );
  });
});

describe('ListingService.flag / unflag', () => {
  it('flags a listing and writes an audit entry', async () => {
    const { service, repository, audit } = buildService();

    await service.flag('admin-1', 'listing-1', 'spam');

    expect(repository.flag).toHaveBeenCalledWith('listing-1', 'spam');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'listings.flagged' }),
    );
  });

  it('unflags a listing and writes an audit entry', async () => {
    const { service, repository, audit } = buildService();

    await service.unflag('admin-1', 'listing-1');

    expect(repository.unflag).toHaveBeenCalledWith('listing-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'listings.unflagged' }),
    );
  });
});

describe('ListingService.adjustApplicantCount', () => {
  it('delegates straight to the repository (cache maintenance only)', async () => {
    const { service, repository } = buildService();

    await service.adjustApplicantCount('listing-1', 1);

    expect(repository.adjustApplicantCount).toHaveBeenCalledWith('listing-1', 1);
  });
});
