import type { ObjectId } from 'mongodb';

export type DocumentType = 'national_id' | 'drivers_license' | 'passport';
export type KycStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export interface KycVerificationDocument {
  _id: ObjectId;
  accountId: ObjectId;
  documentKey: string;
  documentType: DocumentType;
  status: KycStatus;
  // Our own _id is what's sent to Prembly as the correlation reference and echoed back in the
  // webhook — providerReference is purely informational (whatever id Prembly assigns on their
  // side, if any), never used for lookup.
  providerReference: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const kycVerificationIndexes = [
  { key: { accountId: 1 }, name: 'accountId_unique', unique: true },
] as const;
