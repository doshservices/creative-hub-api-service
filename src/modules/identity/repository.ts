import type { Collection, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  kycVerificationIndexes,
  type DocumentType,
  type KycStatus,
  type KycVerificationDocument,
} from './model.js';
import type { KycVerificationDTO } from './dto.js';

const VERIFICATION_PROJECTION = {
  accountId: 1,
  documentType: 1,
  status: 1,
  providerReference: 1,
  failureReason: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: KycVerificationDocument): KycVerificationDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    documentType: doc.documentType,
    status: doc.status,
    providerReference: doc.providerReference,
    failureReason: doc.failureReason,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class KycVerificationRepository {
  private readonly collection: Collection<KycVerificationDocument>;

  constructor(db: Db) {
    this.collection = db.collection<KycVerificationDocument>('kycVerifications');
  }

  async createIndexes(): Promise<void> {
    for (const index of kycVerificationIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  // Resubmission (e.g. after a rejection) upserts the same one-per-account record back to
  // 'pending' and clears any prior failure/provider state, keyed on documentKey/documentType
  // being the caller's newest submission.
  async upsertSubmission(
    accountId: string,
    input: { documentKey: string; documentType: DocumentType },
  ): Promise<KycVerificationDTO> {
    const accountObjectId = new ObjectId(accountId);
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { accountId: accountObjectId },
      {
        $set: {
          documentKey: input.documentKey,
          documentType: input.documentType,
          status: 'pending',
          providerReference: null,
          failureReason: null,
          updatedAt: now,
        },
        $setOnInsert: { _id: new ObjectId(), accountId: accountObjectId, createdAt: now },
      },
      { upsert: true, returnDocument: 'after', projection: VERIFICATION_PROJECTION },
    );
    return toDTO(result!);
  }

  async findByAccountId(accountId: string): Promise<KycVerificationDTO | null> {
    const doc = await this.collection.findOne(
      { accountId: new ObjectId(accountId) },
      { projection: VERIFICATION_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async findById(id: string): Promise<KycVerificationDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: VERIFICATION_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  // Worker-only accessor: the DTO (and its projection) deliberately excludes documentKey from
  // what routes ever return, but the job processor needs it to build the presigned URL it hands
  // to Prembly.
  async findForProcessing(
    id: string,
  ): Promise<{ accountId: string; documentKey: string; documentType: DocumentType } | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: { accountId: 1, documentKey: 1, documentType: 1 } },
    );
    return doc
      ? {
          accountId: doc.accountId.toHexString(),
          documentKey: doc.documentKey,
          documentType: doc.documentType,
        }
      : null;
  }

  // Idempotent by construction: setting the same terminal status twice (a redelivered webhook)
  // is a no-op change, not a double-apply.
  async applyResult(
    id: string,
    status: Extract<KycStatus, 'approved' | 'rejected'>,
    providerReference: string | null,
    failureReason: string | null,
  ): Promise<KycVerificationDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, providerReference, failureReason, updatedAt: new Date() } },
      { returnDocument: 'after', projection: VERIFICATION_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'failed', failureReason: reason, updatedAt: new Date() } },
    );
  }
}
