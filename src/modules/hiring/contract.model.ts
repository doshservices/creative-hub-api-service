import type { ObjectId } from 'mongodb';

export type ContractStatus = 'active' | 'completed' | 'cancelled';

export interface ContractDocument {
  _id: ObjectId;
  listingId: ObjectId;
  applicationId: ObjectId;
  clientAccountId: ObjectId;
  creativeAccountId: ObjectId;
  status: ContractStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const contractIndexes = [
  { key: { applicationId: 1 }, name: 'applicationId_unique', unique: true },
  { key: { clientAccountId: 1, _id: -1 }, name: 'clientAccountId_id', unique: false },
  { key: { creativeAccountId: 1, _id: -1 }, name: 'creativeAccountId_id', unique: false },
] as const;
