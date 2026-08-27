import type { ObjectId } from 'mongodb';

export type DepositStatus = 'pending' | 'awaiting_payment' | 'completed' | 'failed';

export interface DepositDocument {
  _id: ObjectId;
  accountId: ObjectId;
  amountMinor: number;
  currency: string;
  // Our own reference, sent to Flutterwave as tx_ref — the join key between our record and
  // both the initiate response and every subsequent webhook/verify call.
  txRef: string;
  checkoutUrl: string | null;
  providerTransactionId: string | null;
  status: DepositStatus;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const depositIndexes = [
  { key: { accountId: 1, _id: -1 }, name: 'accountId_id', unique: false },
  { key: { txRef: 1 }, name: 'txRef_unique', unique: true },
] as const;
