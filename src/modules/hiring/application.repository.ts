import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  applicationIndexes,
  type ApplicationDocument,
  type ApplicationStatus,
} from './application.model.js';
import type { ApplicationDTO, ApplicationPage } from './dto.js';

export interface CreateApplicationData {
  listingId: string;
  clientAccountId: string;
  creativeAccountId: string;
  message?: string;
}

const APPLICATION_PROJECTION = {
  listingId: 1,
  clientAccountId: 1,
  creativeAccountId: 1,
  status: 1,
  message: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: ApplicationDocument): ApplicationDTO {
  return {
    id: doc._id.toHexString(),
    listingId: doc.listingId.toHexString(),
    clientAccountId: doc.clientAccountId.toHexString(),
    creativeAccountId: doc.creativeAccountId.toHexString(),
    status: doc.status,
    message: doc.message,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class ApplicationRepository {
  private readonly collection: Collection<ApplicationDocument>;

  constructor(db: Db) {
    this.collection = db.collection<ApplicationDocument>('applications');
  }

  async createIndexes(): Promise<void> {
    for (const index of applicationIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: CreateApplicationData): Promise<ApplicationDTO> {
    const now = new Date();
    const doc: ApplicationDocument = {
      _id: new ObjectId(),
      listingId: new ObjectId(input.listingId),
      clientAccountId: new ObjectId(input.clientAccountId),
      creativeAccountId: new ObjectId(input.creativeAccountId),
      status: 'pending',
      message: input.message ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<ApplicationDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: APPLICATION_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async findByListingAndCreative(
    listingId: string,
    creativeAccountId: string,
  ): Promise<ApplicationDTO | null> {
    const doc = await this.collection.findOne(
      { listingId: new ObjectId(listingId), creativeAccountId: new ObjectId(creativeAccountId) },
      { projection: APPLICATION_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listByCreative(
    creativeAccountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ApplicationPage> {
    return this.listByFilter({ creativeAccountId: new ObjectId(creativeAccountId) }, params);
  }

  async listByListing(
    listingId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ApplicationPage> {
    return this.listByFilter({ listingId: new ObjectId(listingId) }, params);
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<ApplicationDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after', projection: APPLICATION_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }

  private async listByFilter(
    baseFilter: Filter<ApplicationDocument>,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<ApplicationPage> {
    const filter: Filter<ApplicationDocument> = cursor
      ? { ...baseFilter, _id: { $lt: new ObjectId(cursor) } }
      : baseFilter;

    const docs = await this.collection
      .find(filter, { projection: APPLICATION_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
