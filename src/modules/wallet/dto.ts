import type { LedgerEntryType } from './ledger.model.js';

export interface WalletDTO {
  id: string;
  accountId: string;
  currency: string;
  balanceMinor: number;
  heldMinor: number;
  availableMinor: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEntryDTO {
  id: string;
  walletId: string;
  accountId: string;
  type: LedgerEntryType;
  amountMinor: number;
  currency: string;
  relatedEntryId: string | null;
  reference: string | null;
  description: string | null;
  createdAt: Date;
}

export interface LedgerPage {
  items: LedgerEntryDTO[];
  nextCursor: string | null;
}
