import type { DocumentType, KycStatus } from './model.js';

export interface KycVerificationDTO {
  id: string;
  accountId: string;
  documentType: DocumentType;
  documentCountry: string;
  status: KycStatus;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KycVerificationPage {
  items: KycVerificationDTO[];
  nextCursor: string | null;
}
