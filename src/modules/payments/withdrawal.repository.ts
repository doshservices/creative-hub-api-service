import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { withdrawalIndexes, type WithdrawalDocument, type WithdrawalStatus } from './withdrawal.model.js';
import type { WithdrawalDTO, WithdrawalPage } from './dto.js';

const WITHDRAWAL_PROJECTION = {
  accountId: 1,
  amountMinor: 1,
  currency: 1,
  reference: 1,
  bankCode: 1,
  accountNumber: 1,
  holdEntryId: 1,
  providerTransferId: 1,
  status: 1,
  failureReason: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: WithdrawalDocument): WithdrawalDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    amountMinor: doc.amountMinor,
    currency: doc.currency,
    reference: doc.reference,
    bankCode: doc.bankCode,
    accountNumber: doc.accountNumber,
    status: doc.status,
    failureReason: doc.failureReason,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class WithdrawalRepository {
  private readonly collection: Collection<WithdrawalDocument>;

  constructor(db: Db) {
    this.collection = db.collection<WithdrawalDocument>('withdrawals');
  }

  async createIndexes(): Promise<void> {
    for (const index of withdrawalIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: {
    accountId: string;
    amountMinor: number;
    currency: string;
    reference: string;
    bankCode: string;
    accountNumber: string;
    holdEntryId: string;
  }): Promise<WithdrawalDTO> {
    const now = new Date();
    const doc: WithdrawalDocument = {
      _id: new ObjectId(),
      accountId: new ObjectId(input.accountId),
      amountMinor: input.amountMinor,
      currency: input.currency,
      reference: input.reference,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      holdEntryId: new ObjectId(input.holdEntryId),
      providerTransferId: null,
      status: 'pending',
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<WithdrawalDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: WITHDRAWAL_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  // Internal-only accessor for the worker/webhook path, which needs the hold id to
  // release/capture — never exposed on the DTO clients see.
  async findHoldEntryId(id: string): Promise<string | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: { holdEntryId: 1 } },
    );
    return doc ? doc.holdEntryId.toHexString() : null;
  }

  // Worker-only shape (includes holdEntryId) — see findHoldEntryId's note.
  async findForProcessing(id: string): Promise<{
    accountId: string;
    amountMinor: number;
    currency: string;
    reference: string;
    bankCode: string;
    accountNumber: string;
    holdEntryId: string;
    status: string;
  } | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: WITHDRAWAL_PROJECTION },
    );
    if (!doc) return null;
    return {
      accountId: doc.accountId.toHexString(),
      amountMinor: doc.amountMinor,
      currency: doc.currency,
      reference: doc.reference,
      bankCode: doc.bankCode,
      accountNumber: doc.accountNumber,
      holdEntryId: doc.holdEntryId.toHexString(),
      status: doc.status,
    };
  }

  async findByReference(reference: string): Promise<WithdrawalDTO | null> {
    const doc = await this.collection.findOne(
      { reference },
      { projection: WITHDRAWAL_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listForAccount(
    accountId: string,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<WithdrawalPage> {
    const filter: Filter<WithdrawalDocument> = cursor
      ? { accountId: new ObjectId(accountId), _id: { $lt: new ObjectId(cursor) } }
      : { accountId: new ObjectId(accountId) };

    const docs = await this.collection
      .find(filter, { projection: WITHDRAWAL_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async markProcessing(id: string, providerTransferId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'processing' satisfies WithdrawalStatus,
          providerTransferId,
          updatedAt: new Date(),
        },
      },
    );
  }

  async markCompleted(id: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'completed' satisfies WithdrawalStatus, updatedAt: new Date() } },
    );
  }

  async markFailed(id: string, failureReason: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { status: 'failed' satisfies WithdrawalStatus, failureReason, updatedAt: new Date() },
      },
    );
  }
}
