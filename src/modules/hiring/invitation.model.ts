import type { ObjectId } from 'mongodb';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface InvitationDocument {
  _id: ObjectId;
  listingId: ObjectId;
  clientAccountId: ObjectId;
  creativeAccountId: ObjectId;
  status: InvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const invitationIndexes = [
  // One outstanding invitation per creative per listing — the unique index is what actually
  // prevents the race; the service-level check just gives a clean error in the common case.
  {
    key: { listingId: 1, creativeAccountId: 1 },
    name: 'listingId_creativeAccountId_unique',
    unique: true,
  },
  { key: { creativeAccountId: 1, _id: -1 }, name: 'creativeAccountId_id', unique: false },
  { key: { listingId: 1, _id: -1 }, name: 'listingId_id', unique: false },
] as const;
