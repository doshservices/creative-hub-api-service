import { describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors.js';
import type { ReviewDTO } from '../dto.js';
import { DuplicateReviewError } from '../repository.js';
import { ReviewsService } from '../service.js';
import type { ContractReaderPort, EventPublisherPort, ReviewRepositoryPort } from '../service.js';

function buildReview(overrides: Partial<ReviewDTO> = {}): ReviewDTO {
  return {
    id: 'review-1',
    contractId: 'contract-1',
    reviewerAccountId: 'client-1',
    revieweeAccountId: 'creative-1',
    rating: 5,
    comment: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  reviews?: Partial<ReviewRepositoryPort>;
  contracts?: Partial<ContractReaderPort>;
  events?: Partial<EventPublisherPort>;
} = {}) {
  const reviews: ReviewRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildReview()),
    findByContractAndReviewer: vi.fn().mockResolvedValue(null),
    listByReviewee: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    ...overrides.reviews,
  };
  const contracts: ContractReaderPort = {
    findById: vi.fn().mockResolvedValue({
      id: 'contract-1',
      clientAccountId: 'client-1',
      creativeAccountId: 'creative-1',
      status: 'completed',
    }),
    ...overrides.contracts,
  };
  const events: EventPublisherPort = {
    publish: vi.fn(),
    ...overrides.events,
  };
  const service = new ReviewsService(reviews, contracts, events);
  return { service, reviews, contracts, events };
}

describe('ReviewsService.submitReview', () => {
  it('throws NotFoundError when the contract does not exist', async () => {
    const { service } = buildService({ contracts: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(service.submitReview('client-1', 'contract-1', { rating: 5 })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws ConflictError when the contract is not completed', async () => {
    const { service } = buildService({
      contracts: {
        findById: vi.fn().mockResolvedValue({
          id: 'contract-1',
          clientAccountId: 'client-1',
          creativeAccountId: 'creative-1',
          status: 'active',
        }),
      },
    });
    await expect(service.submitReview('client-1', 'contract-1', { rating: 5 })).rejects.toThrow(
      ConflictError,
    );
  });

  it('throws ForbiddenError when the caller is not a party to the contract', async () => {
    const { service } = buildService();
    await expect(
      service.submitReview('some-other-account', 'contract-1', { rating: 5 }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ConflictError when the reviewer has already reviewed this contract', async () => {
    const { service } = buildService({
      reviews: { findByContractAndReviewer: vi.fn().mockResolvedValue(buildReview()) },
    });
    await expect(service.submitReview('client-1', 'contract-1', { rating: 5 })).rejects.toThrow(
      ConflictError,
    );
  });

  it('derives revieweeAccountId as the other party when the reviewer is the client', async () => {
    const { service, reviews } = buildService();
    await service.submitReview('client-1', 'contract-1', { rating: 4, comment: 'Great work' });
    expect(reviews.create).toHaveBeenCalledWith({
      contractId: 'contract-1',
      reviewerAccountId: 'client-1',
      revieweeAccountId: 'creative-1',
      rating: 4,
      comment: 'Great work',
    });
  });

  it('derives revieweeAccountId as the other party when the reviewer is the creative', async () => {
    const { service, reviews } = buildService();
    await service.submitReview('creative-1', 'contract-1', { rating: 3 });
    expect(reviews.create).toHaveBeenCalledWith({
      contractId: 'contract-1',
      reviewerAccountId: 'creative-1',
      revieweeAccountId: 'client-1',
      rating: 3,
    });
  });

  it('publishes review.created with the exact payload shape on success', async () => {
    const { service, events } = buildService({
      reviews: { create: vi.fn().mockResolvedValue(buildReview({ id: 'review-42', rating: 5 })) },
    });
    await service.submitReview('client-1', 'contract-1', { rating: 5 });
    expect(events.publish).toHaveBeenCalledWith('review.created', {
      reviewId: 'review-42',
      contractId: 'contract-1',
      revieweeAccountId: 'creative-1',
      rating: 5,
    });
  });

  it('translates a DuplicateReviewError from the repository into a ConflictError', async () => {
    const { service } = buildService({
      reviews: {
        findByContractAndReviewer: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(new DuplicateReviewError('dup')),
      },
    });
    await expect(service.submitReview('client-1', 'contract-1', { rating: 5 })).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('ReviewsService.listReceivedByAccount', () => {
  it('delegates to the repository with the given accountId and page params', async () => {
    const { service, reviews } = buildService();
    await service.listReceivedByAccount('creative-1', { limit: 10 });
    expect(reviews.listByReviewee).toHaveBeenCalledWith('creative-1', { limit: 10 });
  });
});
