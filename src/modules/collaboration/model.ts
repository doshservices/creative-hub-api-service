import type { ObjectId } from 'mongodb';

export type DeliverableStatus = 'submitted' | 'approved' | 'revision_requested';

export interface DeliverableDocument {
  _id: ObjectId;
  contractId: ObjectId;
  // Denormalized from the contract at submission time so ownership checks don't need a
  // cross-module read on every request — same reasoning as hiring's ApplicationDocument.
  clientAccountId: ObjectId;
  creativeAccountId: ObjectId;
  fileId: ObjectId;
  note: string | null;
  status: DeliverableStatus;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const deliverableIndexes = [
  { key: { contractId: 1, _id: -1 }, name: 'contractId_id', unique: false },
] as const;
