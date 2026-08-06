import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { contractIndexes, type ContractDocument } from './contract.model.js';
import type { ContractDTO, ContractPage } from './dto.js';

export interface CreateContractData {
  listingId: string;
  applicationId: string;
  clientAccountId: string;
  creativeAccountId: string;
}

const CONTRACT_PROJECTION = {
  listingId: 1,
  applicationId: 1,
  clientAccountId: 1,
  creativeAccountId: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: ContractDocument): ContractDTO {
  return {
    id: doc._id.toHexString(),
    listingId: doc.listingId.toHexString(),
    applicationId: doc.applicationId.toHexString(),
    clientAccountId: doc.clientAccountId.toHexString(),
    creativeAccountId: doc.creativeAccountId.toHexString(),
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class ContractRepository {
  private readonly collection: Collection<ContractDocument>;

  constructor(db: Db) {
    this.collection = db.collection<ContractDocument>('contracts');
  }

  async createIndexes(): Promise<void> {
    for (const index of contractIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: CreateContractData): Promise<ContractDTO> {
    const now = new Date();
    const doc: ContractDocument = {
      _id: new ObjectId(),
      listingId: new ObjectId(input.listingId),
      applicationId: new ObjectId(input.applicationId),
      clientAccountId: new ObjectId(input.clientAccountId),
      creativeAccountId: new ObjectId(input.creativeAccountId),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findByApplicationId(applicationId: string): Promise<ContractDTO | null> {
    const doc = await this.collection.findOne(
      { applicationId: new ObjectId(applicationId) },
      { projection: CONTRACT_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  // An account is only ever a client or a creative, never both, so a single $or query (each
  // branch served by its own index) is simpler than making the caller know which side it's on.
  async listForAccount(
    accountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ContractPage> {
    const id = new ObjectId(accountId);
    return this.listByFilter({ $or: [{ clientAccountId: id }, { creativeAccountId: id }] }, params);
  }

  private async listByFilter(
    baseFilter: Filter<ContractDocument>,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<ContractPage> {
    const filter: Filter<ContractDocument> = cursor
      ? { ...baseFilter, _id: { $lt: new ObjectId(cursor) } }
      : baseFilter;

    const docs = await this.collection
      .find(filter, { projection: CONTRACT_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
