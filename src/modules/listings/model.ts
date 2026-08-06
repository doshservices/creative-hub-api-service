import type { ObjectId } from 'mongodb';

export type PaymentType = 'fixed' | 'hourly';
// Currencies seen in the frontend mocks (₦ and $) — extend when a real payments/wallet
// currency list exists.
export type Currency = 'NGN' | 'USD';
export type ListingStatus = 'open' | 'closed';

export interface ListingDocument {
  _id: ObjectId;
  clientAccountId: ObjectId;
  title: string;
  description: string;
  location: string;
  paymentType: PaymentType;
  // Integer minor units (kobo/cents) — never a float. See CLAUDE.md's money invariant.
  amountMinor: number;
  currency: Currency;
  duration: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Sorted/paginated by _id descending rather than createdAt: ObjectIds are unique and embed a
// creation timestamp, so they're already time-ordered — that sidesteps the tie-breaking a
// createdAt-only cursor would need for documents created in the same millisecond. The equality
// field (status / clientAccountId) still has to come before the sort key (Mongo's index-prefix
// rule).
export const listingIndexes = [
  { key: { status: 1, _id: -1 }, name: 'status_id' },
  { key: { clientAccountId: 1, _id: -1 }, name: 'clientAccountId_id' },
] as const;
