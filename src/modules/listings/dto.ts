import type { Currency, ListingStatus, PaymentType, ProjectType } from './model.js';

export interface ListingModerationDTO {
  flagged: boolean;
  flaggedReason: string | null;
  flaggedAt: Date | null;
}

export interface ListingDTO {
  id: string;
  clientAccountId: string;
  title: string;
  description: string;
  location: string;
  category: string;
  headcount: number;
  projectType: ProjectType;
  paymentType: PaymentType;
  budgetMinMinor: number;
  budgetMaxMinor: number;
  currency: Currency;
  duration: string;
  status: ListingStatus;
  moderation: ListingModerationDTO;
  applicantCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingPage {
  items: ListingDTO[];
  nextCursor: string | null;
}

export interface ListingStatsDTO {
  activeCount: number;
  byCategory: Record<string, number>;
}
