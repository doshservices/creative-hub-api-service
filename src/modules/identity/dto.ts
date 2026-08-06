import type { DocumentType, KycStatus } from './model.js';

export interface KycVerificationDTO {
  id: string;
  accountId: string;
  documentType: DocumentType;
  status: KycStatus;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
