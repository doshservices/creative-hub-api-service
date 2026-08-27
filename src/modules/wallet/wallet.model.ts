import type { ObjectId } from 'mongodb';

// balanceMinor/heldMinor are a materialized cache of the ledger, updated only inside the same
// transaction as the ledger entry that changes them — see ledger.model.ts and service.ts.
// Never patched independently of a ledger write.
export interface WalletDocument {
  _id: ObjectId;
  accountId: ObjectId;
  currency: string;
  balanceMinor: number;
  heldMinor: number;
  createdAt: Date;
  updatedAt: Date;
}

export const walletIndexes = [
  { key: { accountId: 1, currency: 1 }, name: 'accountId_currency_unique', unique: true },
] as const;
