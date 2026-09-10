import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  portfolioItemIndexes,
  type PortfolioItemDocument,
  type PortfolioMediaType,
} from './portfolio-item.model.js';
import type { PortfolioItemDTO, PortfolioItemPage } from './dto.js';

export interface CreatePortfolioItemData {
  accountId: string;
  fileId: string;
  mediaType: PortfolioMediaType;
  title?: string;
}

export interface PageParams {
  limit: number;
  cursor?: string;
}

const PORTFOLIO_ITEM_PROJECTION = {
  accountId: 1,
  fileId: 1,
  mediaType: 1,
  title: 1,
  createdAt: 1,
} as const;

function toDTO(doc: PortfolioItemDocument): PortfolioItemDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    fileId: doc.fileId.toHexString(),
    mediaType: doc.mediaType,
    title: doc.title,
    createdAt: doc.createdAt,
  };
}

export class PortfolioItemRepository {
  private readonly collection: Collection<PortfolioItemDocument>;

  constructor(db: Db) {
    this.collection = db.collection<PortfolioItemDocument>('portfolioItems');
  }

  async createIndexes(): Promise<void> {
    for (const index of portfolioItemIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: CreatePortfolioItemData): Promise<PortfolioItemDTO> {
    const doc: PortfolioItemDocument = {
      _id: new ObjectId(),
      accountId: new ObjectId(input.accountId),
      fileId: new ObjectId(input.fileId),
      mediaType: input.mediaType,
      title: input.title ?? null,
      createdAt: new Date(),
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<PortfolioItemDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: PORTFOLIO_ITEM_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listForAccount(
    accountId: string,
    { limit, cursor }: PageParams,
  ): Promise<PortfolioItemPage> {
    const filter: Filter<PortfolioItemDocument> = cursor
      ? { accountId: new ObjectId(accountId), _id: { $lt: new ObjectId(cursor) } }
      : { accountId: new ObjectId(accountId) };

    const docs = await this.collection
      .find(filter, { projection: PORTFOLIO_ITEM_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  // Returns whether a document was actually deleted, so the service can tell "not found" apart
  // from "deleted" without a second read.
  async deleteById(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}
