import type { ObjectId } from 'mongodb';

export type ApplicationStatus = 'pending' | 'interview_requested' | 'accepted' | 'rejected';

export interface ApplicationDocument {
  _id: ObjectId;
  listingId: ObjectId;
  // Denormalized from the listing at application time so ownership checks ("does this account
  // own the listing this application is for") don't need a cross-module read on every request.
  clientAccountId: ObjectId;
  creativeAccountId: ObjectId;
  status: ApplicationStatus;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const applicationIndexes = [
  // One application per creative per listing — the unique index is what actually prevents the
  // race; the service-level check just gives a clean error in the common case.
  {
    key: { listingId: 1, creativeAccountId: 1 },
    name: 'listingId_creativeAccountId_unique',
    unique: true,
  },
  { key: { creativeAccountId: 1, _id: -1 }, name: 'creativeAccountId_id', unique: false },
  { key: { listingId: 1, _id: -1 }, name: 'listingId_id', unique: false },
] as const;
