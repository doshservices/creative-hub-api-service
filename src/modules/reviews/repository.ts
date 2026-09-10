import type { Collection, Db, Filter } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import { reviewIndexes, type ReviewDocument } from './model.js';
import type { RatingAggregate, ReviewDTO, ReviewPage } from './dto.js';

export interface CreateReviewData {
  contractId: string;
  reviewerAccountId: string;
  revieweeAccountId: string;
  rating: number;
  comment?: string;
}

const REVIEW_PROJECTION = {
  contractId: 1,
  reviewerAccountId: 1,
  revieweeAccountId: 1,
  rating: 1,
  comment: 1,
  createdAt: 1,
} as const;

function toDTO(doc: ReviewDocument): ReviewDTO {
  return {
    id: doc._id.toHexString(),
    contractId: doc.contractId.toHexString(),
    reviewerAccountId: doc.reviewerAccountId.toHexString(),
    revieweeAccountId: doc.revieweeAccountId.toHexString(),
    rating: doc.rating,
    comment: doc.comment,
    createdAt: doc.createdAt,
  };
}

// A duplicate (contractId, reviewerAccountId) hit the unique index — the caller already
// submitted a review for this contract, so this is a signal to return a clean conflict, not a
// raw driver error. Same convention as wallet/ledger.repository.ts's
// DuplicateIdempotencyKeyError.
export class DuplicateReviewError extends Error {}

export class ReviewRepository {
  private readonly collection: Collection<ReviewDocument>;

  constructor(db: Db) {
    this.collection = db.collection<ReviewDocument>('reviews');
  }

  async createIndexes(): Promise<void> {
    for (const index of reviewIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: CreateReviewData): Promise<ReviewDTO> {
    const doc: ReviewDocument = {
      _id: new ObjectId(),
      contractId: new ObjectId(input.contractId),
      reviewerAccountId: new ObjectId(input.reviewerAccountId),
      revieweeAccountId: new ObjectId(input.revieweeAccountId),
      rating: input.rating,
      comment: input.comment ?? null,
      createdAt: new Date(),
    };
    try {
      await this.collection.insertOne(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new DuplicateReviewError(
          `Review already exists for contract ${input.contractId} by reviewer ${input.reviewerAccountId}`,
        );
      }
      throw error;
    }
    return toDTO(doc);
  }

  async findByContractAndReviewer(
    contractId: string,
    reviewerAccountId: string,
  ): Promise<ReviewDTO | null> {
    const doc = await this.collection.findOne(
      { contractId: new ObjectId(contractId), reviewerAccountId: new ObjectId(reviewerAccountId) },
      { projection: REVIEW_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listByReviewee(
    revieweeAccountId: string,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<ReviewPage> {
    const baseFilter: Filter<ReviewDocument> = {
      revieweeAccountId: new ObjectId(revieweeAccountId),
    };
    const filter: Filter<ReviewDocument> = cursor
      ? { ...baseFilter, _id: { $lt: new ObjectId(cursor) } }
      : baseFilter;

    const docs = await this.collection
      .find(filter, { projection: REVIEW_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  // Real aggregation for a future reconciliation job against users' cached ratingSum/ratingCount
  // — never a cached/stored field itself. Exported via index.ts as
  // getRatingAggregateForAccounts.
  async aggregateRatingsForAccounts(
    accountIds: string[],
  ): Promise<Record<string, RatingAggregate>> {
    if (accountIds.length === 0) {
      return {};
    }
    const rows = await this.collection
      .aggregate<{ _id: ObjectId; ratingSum: number; ratingCount: number }>([
        { $match: { revieweeAccountId: { $in: accountIds.map((id) => new ObjectId(id)) } } },
        {
          $group: {
            _id: '$revieweeAccountId',
            ratingSum: { $sum: '$rating' },
            ratingCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const result: Record<string, RatingAggregate> = {};
    for (const row of rows) {
      result[row._id.toHexString()] = { ratingSum: row.ratingSum, ratingCount: row.ratingCount };
    }
    return result;
  }
}
