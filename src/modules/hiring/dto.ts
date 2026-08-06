import type { ApplicationStatus } from './application.model.js';
import type { ContractStatus } from './contract.model.js';

export interface ApplicationDTO {
  id: string;
  listingId: string;
  clientAccountId: string;
  creativeAccountId: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationPage {
  items: ApplicationDTO[];
  nextCursor: string | null;
}

export interface ContractDTO {
  id: string;
  listingId: string;
  applicationId: string;
  clientAccountId: string;
  creativeAccountId: string;
  status: ContractStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractPage {
  items: ContractDTO[];
  nextCursor: string | null;
}
