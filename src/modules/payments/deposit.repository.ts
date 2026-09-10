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

  // Persists the provider transaction id as soon as it's known (webhook received), independent
  // of whether verification/completion ever follows — this is what lets a deposit stuck in
  // 'awaiting_payment' still be found by findStaleAwaitingPayment below if the reconcile job
  // that was enqueued alongside it is lost or exhausts retries before a redelivered webhook.
  async setProviderTransactionId(id: string, providerTransactionId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { providerTransactionId, updatedAt: new Date() } },
    );
  }

  // Safety-net query for the reconciliation sweep (queue.ts's processReconcileSweep): deposits
  // that have been sitting in 'awaiting_payment' since before `olderThan` AND already have a
  // provider transaction id on file (i.e. a webhook was received at some point, so there's
  // something to re-verify). A deposit with no provider id yet never got a webhook at all — that
  // is a separate, unrecoverable-by-verify case this query deliberately excludes; see the
  // reconciliation job's registration comment in index.ts.
  async findStaleAwaitingPayment(
    olderThan: Date,
    limit = 100,
  ): Promise<Array<{ id: string; providerTransactionId: string }>> {
    const docs = await this.collection
      .find(
        { status: 'awaiting_payment', providerTransactionId: { $ne: null }, updatedAt: { $lt: olderThan } },
        { projection: { providerTransactionId: 1 } },
      )
      .sort({ updatedAt: 1 })
      .limit(limit)
      .toArray();

    return docs
      .filter((doc): doc is DepositDocument & { providerTransactionId: string } => doc.providerTransactionId !== null)
      .map((doc) => ({ id: doc._id.toHexString(), providerTransactionId: doc.providerTransactionId }));
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

  // Cross-account admin view (GET /admin/deposits) — no accountId scoping, unlike listForAccount.
  async listAll(params: {
    limit: number;
    cursor?: string;
    status?: DepositStatus;
  }): Promise<DepositPage> {
    const filter: Filter<DepositDocument> = {};
    if (params.status) {
      filter.status = params.status;
    }
    if (params.cursor) {
      filter._id = { $lt: new ObjectId(params.cursor) };
    }

    const docs = await this.collection
      .find(filter, { projection: DEPOSIT_PROJECTION })
      .sort({ _id: -1 })
      .limit(params.limit + 1)
      .toArray();

    const hasMore = docs.length > params.limit;
    const items = docs.slice(0, params.limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
