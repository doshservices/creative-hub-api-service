import type { Collection, Db, Document, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  listingIndexes,
  type Currency,
  type ListingDocument,
  type ListingStatus,
  type PaymentType,
  type ProjectType,
} from './model.js';
import type { ListingDTO, ListingPage, ListingStatsDTO } from './dto.js';

export interface CreateListingData {
  clientAccountId: string;
  title: string;
  description: string;
  location: string;
  category: string;
  headcount: number;
  projectType: ProjectType;
  paymentType: PaymentType;
  budgetMinMinor: number;
  budgetMaxMinor: number;
  currency: Currency;
  duration: string;
  status: ListingStatus;
}

export interface UpdateListingData {
  title?: string;
  description?: string;
  location?: string;
  category?: string;
  headcount?: number;
  projectType?: ProjectType;
  paymentType?: PaymentType;
  budgetMinMinor?: number;
  budgetMaxMinor?: number;
  currency?: Currency;
  duration?: string;
  status?: ListingStatus;
}

export interface PublicListingFilters {
  search?: string;
  category?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
}

const LISTING_PROJECTION = {
  clientAccountId: 1,
  title: 1,
  description: 1,
  location: 1,
  category: 1,
  headcount: 1,
  projectType: 1,
  paymentType: 1,
  budgetMinMinor: 1,
  budgetMaxMinor: 1,
  currency: 1,
  duration: 1,
  status: 1,
  moderation: 1,
  applicantCount: 1,
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
    category: doc.category,
    headcount: doc.headcount,
    projectType: doc.projectType,
    paymentType: doc.paymentType,
    budgetMinMinor: doc.budgetMinMinor,
    budgetMaxMinor: doc.budgetMaxMinor,
    currency: doc.currency,
    duration: doc.duration,
    status: doc.status,
    moderation: doc.moderation,
    applicantCount: doc.applicantCount,
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
      category: input.category,
      headcount: input.headcount,
      projectType: input.projectType,
      paymentType: input.paymentType,
      budgetMinMinor: input.budgetMinMinor,
      budgetMaxMinor: input.budgetMaxMinor,
      currency: input.currency,
      duration: input.duration,
      status: input.status,
      moderation: { flagged: false, flaggedReason: null, flaggedAt: null },
      applicantCount: 0,
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

  async listPublic(
    filters: PublicListingFilters,
    params: { limit: number; cursor?: string },
  ): Promise<ListingPage> {
    const filter: Filter<ListingDocument> = {
      status: 'open',
      'moderation.flagged': false,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.location ? { location: filters.location } : {}),
      // Budget range filter: a listing matches when its [min,max] range overlaps the caller's
      // requested [budgetMin,budgetMax] range, not an exact match.
      ...(filters.budgetMin !== undefined ? { budgetMaxMinor: { $gte: filters.budgetMin } } : {}),
      ...(filters.budgetMax !== undefined ? { budgetMinMinor: { $lte: filters.budgetMax } } : {}),
      ...(filters.search ? { $text: { $search: filters.search } } : {}),
    };
    return this.listByFilter(filter, params);
  }

  async listByClient(
    clientAccountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ListingPage> {
    return this.listByFilter({ clientAccountId: new ObjectId(clientAccountId) }, params);
  }

  async update(id: string, patch: UpdateListingData): Promise<ListingDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: 'after', projection: LISTING_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }

  async close(id: string): Promise<ListingDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status: 'closed', updatedAt: new Date() } },
      { returnDocument: 'after', projection: LISTING_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }

  async flag(id: string, reason: string): Promise<ListingDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          'moderation.flagged': true,
          'moderation.flaggedReason': reason,
          'moderation.flaggedAt': new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after', projection: LISTING_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }

  async unflag(id: string): Promise<ListingDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          'moderation.flagged': false,
          'moderation.flaggedReason': null,
          'moderation.flaggedAt': null,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after', projection: LISTING_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }

  // Best-effort cache maintenance driven by events.ts (application.created/withdrawn) — see the
  // applicantCount comment on the model. An aggregation-pipeline update floors the result at 0
  // atomically (no read-then-write race), so an out-of-order withdraw event can never take the
  // counter negative.
  async adjustApplicantCount(id: string, delta: number): Promise<void> {
    const pipeline: Document[] = [
      {
        $set: {
          applicantCount: { $max: [{ $add: ['$applicantCount', delta] }, 0] },
          updatedAt: '$$NOW',
        },
      },
    ];
    await this.collection.updateOne({ _id: new ObjectId(id) }, pipeline);
  }

  // Real aggregation for the owner's own stat tiles — not derived from any cached field.
  async statsForClient(clientAccountId: string): Promise<ListingStatsDTO> {
    const pipeline = [
      { $match: { clientAccountId: new ObjectId(clientAccountId) } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        },
      },
    ];
    const rows = await this.collection
      .aggregate<{ _id: string; count: number; activeCount: number }>(pipeline)
      .toArray();

    const byCategory: Record<string, number> = {};
    let activeCount = 0;
    for (const row of rows) {
      byCategory[row._id] = row.count;
      activeCount += row.activeCount;
    }
    return { activeCount, byCategory };
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
