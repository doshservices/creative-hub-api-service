import type { ObjectId } from 'mongodb';

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface WithdrawalDocument {
  _id: ObjectId;
  accountId: ObjectId;
  amountMinor: number;
  currency: string;
  // Our own reference, sent to Flutterwave as the transfer's `reference`.
  reference: string;
  bankCode: string;
  accountNumber: string;
  // The wallet ledger hold backing this withdrawal — captured on success, released on failure.
  // Never a separate mutable balance field; see the money-and-ledger skill.
  holdEntryId: ObjectId;
  providerTransferId: string | null;
  status: WithdrawalStatus;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const withdrawalIndexes = [
  { key: { accountId: 1, _id: -1 }, name: 'accountId_id', unique: false },
  { key: { reference: 1 }, name: 'reference_unique', unique: true },
] as const;
