import type { ClientSession, Collection, Db, Filter } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import { ledgerEntryIndexes, type LedgerEntryDocument, type LedgerEntryType } from './ledger.model.js';
import type { LedgerEntryDTO, LedgerPage } from './dto.js';

const LEDGER_PROJECTION = {
  walletId: 1,
  accountId: 1,
  type: 1,
  amountMinor: 1,
  currency: 1,
  relatedEntryId: 1,
  reference: 1,
  description: 1,
  createdAt: 1,
} as const;

function toDTO(doc: LedgerEntryDocument): LedgerEntryDTO {
  return {
    id: doc._id.toHexString(),
    walletId: doc.walletId.toHexString(),
    accountId: doc.accountId.toHexString(),
    type: doc.type,
    amountMinor: doc.amountMinor,
    currency: doc.currency,
    relatedEntryId: doc.relatedEntryId ? doc.relatedEntryId.toHexString() : null,
    reference: doc.reference,
    description: doc.description,
    createdAt: doc.createdAt,
  };
}

export interface CreateLedgerEntryInput {
  walletId: string;
  accountId: string;
  type: LedgerEntryType;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  relatedEntryId?: string;
  reference?: string;
  description?: string;
}

// A duplicate idempotencyKey on the same wallet hit the unique index — the caller already
// resolved a request with this key to an existing entry, so this is a signal to fetch and
// return it, not a real failure. See the money-and-ledger skill.
export class DuplicateIdempotencyKeyError extends Error {}

export class LedgerRepository {
  private readonly collection: Collection<LedgerEntryDocument>;

  constructor(db: Db) {
    this.collection = db.collection<LedgerEntryDocument>('ledgerEntries');
  }

  async createIndexes(): Promise<void> {
    for (const index of ledgerEntryIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: CreateLedgerEntryInput, session: ClientSession): Promise<LedgerEntryDTO> {
    const doc: LedgerEntryDocument = {
      _id: new ObjectId(),
      walletId: new ObjectId(input.walletId),
      accountId: new ObjectId(input.accountId),
      type: input.type,
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      relatedEntryId: input.relatedEntryId ? new ObjectId(input.relatedEntryId) : null,
      reference: input.reference ?? null,
      description: input.description ?? null,
      createdAt: new Date(),
    };
    try {
      await this.collection.insertOne(doc, { session });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new DuplicateIdempotencyKeyError(input.idempotencyKey);
      }
      throw error;
    }
    return toDTO(doc);
  }

  async findByIdempotencyKey(
    walletId: string,
    idempotencyKey: string,
  ): Promise<LedgerEntryDTO | null> {
    const doc = await this.collection.findOne(
      { walletId: new ObjectId(walletId), idempotencyKey },
      { projection: LEDGER_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async findById(id: string): Promise<LedgerEntryDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: LEDGER_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  // Entries that reference a given hold (its releases/captures) — used to check whether a hold
  // has already been resolved before releasing or capturing it again.
  async findByRelatedEntryId(relatedEntryId: string): Promise<LedgerEntryDTO[]> {
    const docs = await this.collection
      .find({ relatedEntryId: new ObjectId(relatedEntryId) }, { projection: LEDGER_PROJECTION })
      .toArray();
    return docs.map(toDTO);
  }

  async listByWallet(
    walletId: string,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<LedgerPage> {
    const filter: Filter<LedgerEntryDocument> = cursor
      ? { walletId: new ObjectId(walletId), _id: { $lt: new ObjectId(cursor) } }
      : { walletId: new ObjectId(walletId) };

    const docs = await this.collection
      .find(filter, { projection: LEDGER_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
