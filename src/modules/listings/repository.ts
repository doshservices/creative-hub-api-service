import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { listingIndexes, type Currency, type ListingDocument, type PaymentType } from './model.js';
import type { ListingDTO, ListingPage } from './dto.js';

export interface CreateListingData {
  clientAccountId: string;
  title: string;
  description: string;
  location: string;
  paymentType: PaymentType;
  amountMinor: number;
  currency: Currency;
  duration: string;
}

const LISTING_PROJECTION = {
  clientAccountId: 1,
  title: 1,
  description: 1,
  location: 1,
  paymentType: 1,
  amountMinor: 1,
  currency: 1,
  duration: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: ListingDocument): ListingDTO {
  return {
    id: doc._id.toHexString(),
    clientAccountId: doc.clientAccountId.toHexString(),
    title: doc.title,
    description: doc.description,
    location: doc.location,
    paymentType: doc.paymentType,
    amountMinor: doc.amountMinor,
    currency: doc.currency,
    duration: doc.duration,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class ListingRepository {
  private readonly collection: Collection<ListingDocument>;

  constructor(db: Db) {
    this.collection = db.collection<ListingDocument>('listings');
  }

  async createIndexes(): Promise<void> {
    for (const index of listingIndexes) {
      await this.collection.createIndex(index.key, { name: index.name });
    }
  }

  async create(input: CreateListingData): Promise<ListingDTO> {
    const now = new Date();
    const doc: ListingDocument = {
      _id: new ObjectId(),
      clientAccountId: new ObjectId(input.clientAccountId),
      title: input.title,
      description: input.description,
      location: input.location,
      paymentType: input.paymentType,
      amountMinor: input.amountMinor,
      currency: input.currency,
      duration: input.duration,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<ListingDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: LISTING_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listOpen(params: { limit: number; cursor?: string }): Promise<ListingPage> {
    return this.listByFilter({ status: 'open' }, params);
  }

  async listByClient(
    clientAccountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ListingPage> {
    return this.listByFilter({ clientAccountId: new ObjectId(clientAccountId) }, params);
  }

  async close(id: string): Promise<ListingDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status: 'closed', updatedAt: new Date() } },
      { returnDocument: 'after', projection: LISTING_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }

  private async listByFilter(
    baseFilter: Filter<ListingDocument>,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<ListingPage> {
    const filter: Filter<ListingDocument> = cursor
      ? { ...baseFilter, _id: { $lt: new ObjectId(cursor) } }
      : baseFilter;

    const docs = await this.collection
      .find(filter, { projection: LISTING_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
