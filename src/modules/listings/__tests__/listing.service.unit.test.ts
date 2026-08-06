import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../../common/errors.js';
import type { ListingDTO } from '../dto.js';
import type { CreateListingInput, ListingRepositoryPort } from '../service.js';
import { ListingService } from '../service.js';

function buildListing(overrides: Partial<ListingDTO> = {}): ListingDTO {
  return {
    id: 'listing-1',
    clientAccountId: 'client-1',
    title: 'Dance Crew Needed',
    description: 'Looking for dancers',
    location: 'Lagos, Nigeria',
    paymentType: 'fixed',
    amountMinor: 10_000_000,
    currency: 'NGN',
    duration: '3 days',
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: Partial<ListingRepositoryPort> = {}) {
  const repository: ListingRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildListing()),
    findById: vi.fn().mockResolvedValue(buildListing()),
    listOpen: vi.fn().mockResolvedValue({ items: [buildListing()], nextCursor: null }),
    listByClient: vi.fn().mockResolvedValue({ items: [buildListing()], nextCursor: null }),
    close: vi.fn().mockResolvedValue(buildListing({ status: 'closed' })),
    ...overrides,
  };
  const service = new ListingService(repository);
  return { service, repository };
}

const minimalInput: CreateListingInput = {
  title: 'Dance Crew Needed',
  description: 'Looking for dancers',
  location: 'Lagos, Nigeria',
  paymentType: 'fixed',
  amountMinor: 10_000_000,
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
    });
  });
});

describe('ListingService.getById', () => {
  it('throws NotFoundError when the listing does not exist', async () => {
    const { service } = buildService({ findById: vi.fn().mockResolvedValue(null) });

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
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
