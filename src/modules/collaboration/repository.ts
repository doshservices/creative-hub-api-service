import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { deliverableIndexes, type DeliverableDocument, type DeliverableStatus } from './model.js';
import type { DeliverableDTO, DeliverablePage } from './dto.js';

const DELIVERABLE_PROJECTION = {
  contractId: 1,
  clientAccountId: 1,
  creativeAccountId: 1,
  fileId: 1,
  note: 1,
  status: 1,
  reviewNote: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: DeliverableDocument): DeliverableDTO {
  return {
    id: doc._id.toHexString(),
    contractId: doc.contractId.toHexString(),
    clientAccountId: doc.clientAccountId.toHexString(),
    creativeAccountId: doc.creativeAccountId.toHexString(),
    fileId: doc.fileId.toHexString(),
    note: doc.note,
    status: doc.status,
    reviewNote: doc.reviewNote,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface CreateDeliverableData {
  contractId: string;
  clientAccountId: string;
  creativeAccountId: string;
  fileId: string;
  note?: string;
}

export class DeliverableRepository {
  private readonly collection: Collection<DeliverableDocument>;

  constructor(db: Db) {
    this.collection = db.collection<DeliverableDocument>('deliverables');
  }

  async createIndexes(): Promise<void> {
    for (const index of deliverableIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: CreateDeliverableData): Promise<DeliverableDTO> {
    const now = new Date();
    const doc: DeliverableDocument = {
      _id: new ObjectId(),
      contractId: new ObjectId(input.contractId),
      clientAccountId: new ObjectId(input.clientAccountId),
      creativeAccountId: new ObjectId(input.creativeAccountId),
      fileId: new ObjectId(input.fileId),
      note: input.note ?? null,
      status: 'submitted',
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<DeliverableDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: DELIVERABLE_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listForContract(
    contractId: string,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<DeliverablePage> {
    const filter: Filter<DeliverableDocument> = cursor
      ? { contractId: new ObjectId(contractId), _id: { $lt: new ObjectId(cursor) } }
      : { contractId: new ObjectId(contractId) };

    const docs = await this.collection
      .find(filter, { projection: DELIVERABLE_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async updateReview(
    id: string,
    status: Extract<DeliverableStatus, 'approved' | 'revision_requested'>,
    reviewNote: string | null,
  ): Promise<DeliverableDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, reviewNote, updatedAt: new Date() } },
      { returnDocument: 'after', projection: DELIVERABLE_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }
}
