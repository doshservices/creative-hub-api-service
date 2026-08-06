import type { Currency, ListingStatus, PaymentType } from './model.js';

export interface ListingDTO {
  id: string;
  clientAccountId: string;
  title: string;
  description: string;
  location: string;
  paymentType: PaymentType;
  amountMinor: number;
  currency: Currency;
  duration: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingPage {
  items: ListingDTO[];
  nextCursor: string | null;
}
