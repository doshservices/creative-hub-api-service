import type { ObjectId } from 'mongodb';

// Append-only, same principle as the wallet ledger — a review is never edited or deleted once
// posted, so there's deliberately no `updatedAt` and no update/delete repository method.
export interface ReviewDocument {
  _id: ObjectId;
  contractId: ObjectId;
  reviewerAccountId: ObjectId;
  revieweeAccountId: ObjectId;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export const reviewIndexes = [
  // One review per party per contract — the unique index is what actually prevents the race;
  // the service-level check just gives a clean error in the common case. See
  // hiring/application.model.ts's applicationIndexes for the identical phrasing/convention.
  {
    key: { contractId: 1, reviewerAccountId: 1 },
    name: 'contractId_reviewerAccountId_unique',
    unique: true,
  },
  // Supports GET /talents/:accountId/reviews (public browse, newest first).
  { key: { revieweeAccountId: 1, _id: -1 }, name: 'revieweeAccountId_id', unique: false },
] as const;
