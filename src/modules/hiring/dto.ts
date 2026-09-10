import type { ApplicationStatus } from './application.model.js';
import type { ContractStatus } from './contract.model.js';
import type { InvitationStatus } from './invitation.model.js';

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
  // Wallet ledger entry id for the escrow hold funded on acceptance — null only for contracts
  // predating escrow funding. See contract.repository.ts.
  escrowHoldEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractPage {
  items: ContractDTO[];
  nextCursor: string | null;
}

export interface InvitationDTO {
  id: string;
  listingId: string;
  clientAccountId: string;
  creativeAccountId: string;
  status: InvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationPage {
  items: InvitationDTO[];
  nextCursor: string | null;
}

export interface CreativeHiringStatsDTO {
  activeContracts: number;
  pendingApplications: number;
}

export interface ClientHiringStatsDTO {
  applicantsWaiting: number;
}

export type HiringStatsDTO = CreativeHiringStatsDTO | ClientHiringStatsDTO;
