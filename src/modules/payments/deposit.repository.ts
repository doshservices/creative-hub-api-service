import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { depositIndexes, type DepositDocument, type DepositStatus } from './deposit.model.js';
import type { DepositDTO, DepositPage } from './dto.js';

const DEPOSIT_PROJECTION = {
  accountId: 1,
  amountMinor: 1,
  currency: 1,
  txRef: 1,
  checkoutUrl: 1,
  providerTransactionId: 1,
  status: 1,
  failureReason: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: DepositDocument): DepositDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    amountMinor: doc.amountMinor,
    currency: doc.currency,
    txRef: doc.txRef,
    checkoutUrl: doc.checkoutUrl,
    status: doc.status,
    failureReason: doc.failureReason,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class DepositRepository {
  private readonly collection: Collection<DepositDocument>;

  constructor(db: Db) {
    this.collection = db.collection<DepositDocument>('deposits');
  }

  async createIndexes(): Promise<void> {
    for (const index of depositIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: {
    accountId: string;
    amountMinor: number;
    currency: string;
    txRef: string;
  }): Promise<DepositDTO> {
    const now = new Date();
    const doc: DepositDocument = {
      _id: new ObjectId(),
      accountId: new ObjectId(input.accountId),
      amountMinor: input.amountMinor,
      currency: input.currency,
      txRef: input.txRef,
      checkoutUrl: null,
      providerTransactionId: null,
      status: 'pending',
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<DepositDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: DEPOSIT_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async findByTxRef(txRef: string): Promise<DepositDTO | null> {
    const doc = await this.collection.findOne({ txRef }, { projection: DEPOSIT_PROJECTION });
    return doc ? toDTO(doc) : null;
  }

  async listForAccount(
    accountId: string,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<DepositPage> {
    const filter: Filter<DepositDocument> = cursor
      ? { accountId: new ObjectId(accountId), _id: { $lt: new ObjectId(cursor) } }
      : { accountId: new ObjectId(accountId) };

    const docs = await this.collection
      .find(filter, { projection: DEPOSIT_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async setCheckoutUrl(id: string, checkoutUrl: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { checkoutUrl, status: 'awaiting_payment', updatedAt: new Date() } },
    );
  }

  async markCompleted(id: string, providerTransactionId: string): Promise<DepositDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'completed' satisfies DepositStatus,
          providerTransactionId,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after', projection: DEPOSIT_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }

  async markFailed(id: string, failureReason: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'failed' satisfies DepositStatus, failureReason, updatedAt: new Date() } },
    );
  }
}
