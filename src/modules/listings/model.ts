import type { ObjectId } from 'mongodb';

export type PaymentType = 'fixed' | 'hourly';
// Currencies seen in the frontend mocks (₦ and $) — extend when a real payments/wallet
// currency list exists.
export type Currency = 'NGN' | 'USD';
export type ListingStatus = 'draft' | 'open' | 'closed';
export type ProjectType = 'remote' | 'onsite' | 'hybrid';

export interface ListingModeration {
  flagged: boolean;
  flaggedReason: string | null;
  flaggedAt: Date | null;
}

export interface ListingDocument {
  _id: ObjectId;
  clientAccountId: ObjectId;
  title: string;
  description: string;
  location: string;
  category: string;
  headcount: number;
  projectType: ProjectType;
  paymentType: PaymentType;
  // Integer minor units (kobo/cents) — never a float. See CLAUDE.md's money invariant.
  // budgetMaxMinor >= budgetMinMinor is enforced in the service, not the driver.
  budgetMinMinor: number;
  budgetMaxMinor: number;
  currency: Currency;
  duration: string;
  status: ListingStatus;
  // Kept apart from lifecycle `status` so an admin flag doesn't destroy the draft/open/closed
  // state and can be lifted independently of it.
  moderation: ListingModeration;
  // Maintained ONLY by the application.created/application.withdrawn event subscriber in
  // events.ts — never written by a route or any other service method. It's a cache: hiring's
  // exported getApplicationCountsByListingIds is the real source of truth for a reconciliation
  // job if this ever drifts (event bus is best-effort, see src/common/event-bus.ts).
  applicantCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Sorted/paginated by _id descending rather than createdAt: ObjectIds are unique and embed a
// creation timestamp, so they're already time-ordered — that sidesteps the tie-breaking a
// createdAt-only cursor would need for documents created in the same millisecond. The equality
// fields (status/moderation.flagged, or clientAccountId) still have to come before the sort key
// (Mongo's index-prefix rule).
export const listingIndexes = [
  // Covers the public browse query (status:'open', moderation.flagged:false) as a prefix, and
  // admin's flagged-listing queries too.
  { key: { status: 1, 'moderation.flagged': 1, _id: -1 }, name: 'status_flagged_id' },
  { key: { clientAccountId: 1, _id: -1 }, name: 'clientAccountId_id' },
  // Supports the `search` query param on GET / (public browse) via $text.
  { key: { title: 'text', description: 'text' }, name: 'title_description_text' },
] as const;
