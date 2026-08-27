import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { fileRecordIndexes, type FileRecordDocument } from './model.js';
import type { FileRecordDTO, FileRecordPage } from './dto.js';

const FILE_PROJECTION = {
  ownerId: 1,
  key: 1,
  purpose: 1,
  contentType: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: FileRecordDocument): FileRecordDTO {
  return {
    id: doc._id.toHexString(),
    ownerId: doc.ownerId.toHexString(),
    key: doc.key,
    purpose: doc.purpose,
    contentType: doc.contentType,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class FileRepository {
  private readonly collection: Collection<FileRecordDocument>;

  constructor(db: Db) {
    this.collection = db.collection<FileRecordDocument>('files');
  }

  async createIndexes(): Promise<void> {
    for (const index of fileRecordIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: {
    ownerId: string;
    key: string;
    purpose: string;
    contentType: string;
  }): Promise<FileRecordDTO> {
    const now = new Date();
    const doc: FileRecordDocument = {
      _id: new ObjectId(),
      ownerId: new ObjectId(input.ownerId),
      key: input.key,
      purpose: input.purpose,
      contentType: input.contentType,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<FileRecordDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: FILE_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listForOwner(
    ownerId: string,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<FileRecordPage> {
    const filter: Filter<FileRecordDocument> = cursor
      ? { ownerId: new ObjectId(ownerId), _id: { $lt: new ObjectId(cursor) } }
      : { ownerId: new ObjectId(ownerId) };

    const docs = await this.collection
      .find(filter, { projection: FILE_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async markConfirmed(id: string): Promise<FileRecordDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status: 'confirmed', updatedAt: new Date() } },
      { returnDocument: 'after', projection: FILE_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }
}
