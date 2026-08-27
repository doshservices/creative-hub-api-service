import type { ObjectId } from 'mongodb';

// Append-only: no updatedAt, no update/delete methods on the repository. A hold is released or
// captured by writing a new entry that references it via relatedEntryId, never by editing the
// hold entry in place — see the money-and-ledger skill.
export type LedgerEntryType = 'credit' | 'debit' | 'hold' | 'hold_release' | 'hold_capture';

export interface LedgerEntryDocument {
  _id: ObjectId;
  walletId: ObjectId;
  accountId: ObjectId;
  type: LedgerEntryType;
  // Always positive; direction is carried by `type`, never by sign.
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  relatedEntryId: ObjectId | null;
  reference: string | null;
  description: string | null;
  createdAt: Date;
}

export const ledgerEntryIndexes = [
  { key: { walletId: 1, _id: -1 }, name: 'walletId_id', unique: false },
  {
    key: { walletId: 1, idempotencyKey: 1 },
    name: 'walletId_idempotencyKey_unique',
    unique: true,
  },
  { key: { relatedEntryId: 1 }, name: 'relatedEntryId', unique: false },
] as const;
