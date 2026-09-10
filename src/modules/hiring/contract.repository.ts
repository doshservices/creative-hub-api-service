import type { ClientSession, Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { contractIndexes, type ContractDocument, type ContractStatus } from './contract.model.js';
import type { ContractDTO, ContractPage } from './dto.js';

export interface CreateContractData {
  listingId: string;
  applicationId: string;
  clientAccountId: string;
  creativeAccountId: string;
  // The wallet ledger entry id for the escrow hold funded against the client's wallet before
  // this contract exists — see service.ts's persistContractWithEscrow. Nullable only so the
  // repository type doesn't lie about the model; every caller in this codebase supplies one.
  escrowHoldEntryId: string | null;
}

const CONTRACT_PROJECTION = {
  listingId: 1,
  applicationId: 1,
  clientAccountId: 1,
  creativeAccountId: 1,
  status: 1,
  escrowHoldEntryId: 1,
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
    escrowHoldEntryId: doc.escrowHoldEntryId ? doc.escrowHoldEntryId.toHexString() : null,
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

  async create(input: CreateContractData, session?: ClientSession): Promise<ContractDTO> {
    const now = new Date();
    const doc: ContractDocument = {
      _id: new ObjectId(),
      listingId: new ObjectId(input.listingId),
      applicationId: new ObjectId(input.applicationId),
      clientAccountId: new ObjectId(input.clientAccountId),
      creativeAccountId: new ObjectId(input.creativeAccountId),
      status: 'active',
      escrowHoldEntryId: input.escrowHoldEntryId ? new ObjectId(input.escrowHoldEntryId) : null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc, session ? { session } : {});
    return toDTO(doc);
  }

  async findById(id: string): Promise<ContractDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: CONTRACT_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async findByApplicationId(applicationId: string): Promise<ContractDTO | null> {
    const doc = await this.collection.findOne(
      { applicationId: new ObjectId(applicationId) },
      { projection: CONTRACT_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async updateStatus(
    id: string,
    status: ContractStatus,
    session?: ClientSession,
  ): Promise<ContractDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      {
        returnDocument: 'after',
        projection: CONTRACT_PROJECTION,
        ...(session ? { session } : {}),
      },
    );
    return result ? toDTO(result) : null;
  }

  // Talent-side stat tile: contracts currently in progress.
  async countActiveForCreative(creativeAccountId: string): Promise<number> {
    return this.collection.countDocuments({
      creativeAccountId: new ObjectId(creativeAccountId),
      status: 'active',
    });
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
