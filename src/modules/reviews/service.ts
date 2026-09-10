import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { ReviewDTO, ReviewPage } from './dto.js';
import { DuplicateReviewError } from './repository.js';

export interface SubmitReviewInput {
  rating: number;
  comment?: string;
}

export interface PageParams {
  limit: number;
  cursor?: string;
}

// Minimal read surface this module needs from `hiring` — see hiring/index.ts, the only import
// path other modules may use to reach that module. A review can only be submitted once the
// contract is 'completed'.
export interface ContractReaderPort {
  findById(id: string): Promise<{
    id: string;
    clientAccountId: string;
    creativeAccountId: string;
    status: string;
  } | null>;
}

export interface ReviewRepositoryPort {
  create(input: {
    contractId: string;
    reviewerAccountId: string;
    revieweeAccountId: string;
    rating: number;
    comment?: string;
  }): Promise<ReviewDTO>;
  findByContractAndReviewer(contractId: string, reviewerAccountId: string): Promise<ReviewDTO | null>;
  listByReviewee(revieweeAccountId: string, params: PageParams): Promise<ReviewPage>;
}

// In-process pub/sub for cross-module cache maintenance (users' rating aggregate) — see
// src/common/event-bus.ts. Best-effort: a handler throwing never fails the publisher's request.
export interface EventPublisherPort {
  publish<T>(event: string, payload: T): void;
}

export interface ReviewCreatedEventPayload {
  reviewId: string;
  contractId: string;
  revieweeAccountId: string;
  rating: number;
}

export class ReviewsService {
  constructor(
    private readonly reviews: ReviewRepositoryPort,
    private readonly contracts: ContractReaderPort,
    private readonly events: EventPublisherPort,
  ) {}

  async submitReview(
    reviewerAccountId: string,
    contractId: string,
    input: SubmitReviewInput,
  ): Promise<ReviewDTO> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) {
      throw new NotFoundError('Contract not found');
    }
    if (contract.status !== 'completed') {
      throw new ConflictError('Only a completed contract can be reviewed');
    }
    if (
      contract.clientAccountId !== reviewerAccountId &&
      contract.creativeAccountId !== reviewerAccountId
    ) {
      throw new ForbiddenError('You are not a party to this contract');
    }

    // revieweeAccountId is derived server-side as whichever party the caller is NOT — never
    // client-supplied. See CLAUDE.md's validation invariant.
    const revieweeAccountId =
      contract.clientAccountId === reviewerAccountId
        ? contract.creativeAccountId
        : contract.clientAccountId;

    const existing = await this.reviews.findByContractAndReviewer(contractId, reviewerAccountId);
    if (existing) {
      throw new ConflictError('You have already reviewed this contract');
    }

    let review: ReviewDTO;
    try {
      review = await this.reviews.create({
        contractId,
        reviewerAccountId,
        revieweeAccountId,
        rating: input.rating,
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      });
    } catch (error) {
      // The unique index is the real guard against the race (two concurrent submissions from
      // the same reviewer for the same contract); the findByContractAndReviewer check above just
      // gives a clean error in the common, non-racing case. See repository.ts's
      // DuplicateReviewError and wallet/ledger.repository.ts's DuplicateIdempotencyKeyError for
      // the identical convention.
      if (error instanceof DuplicateReviewError) {
        throw new ConflictError('You have already reviewed this contract');
      }
      throw error;
    }

    this.events.publish<ReviewCreatedEventPayload>('review.created', {
      reviewId: review.id,
      contractId: review.contractId,
      revieweeAccountId: review.revieweeAccountId,
      rating: review.rating,
    });

    return review;
  }

  async listReceivedByAccount(revieweeAccountId: string, params: PageParams): Promise<ReviewPage> {
    return this.reviews.listByReviewee(revieweeAccountId, params);
  }
}
