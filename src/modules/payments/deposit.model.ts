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
  // Backs the admin cross-account list (GET /admin/deposits), optionally filtered by status.
  { key: { status: 1, _id: -1 }, name: 'status_id', unique: false },
  // Backs the reconciliation sweep's stale query (queue.ts's processReconcileSweep): deposits
  // stuck in 'awaiting_payment' sorted by how long ago they were last touched.
  { key: { status: 1, updatedAt: 1 }, name: 'status_updatedAt', unique: false },
] as const;
