import type { ClientSession, Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  invitationIndexes,
  type InvitationDocument,
  type InvitationStatus,
} from './invitation.model.js';
import type { InvitationDTO, InvitationPage } from './dto.js';

export interface CreateInvitationData {
  listingId: string;
  clientAccountId: string;
  creativeAccountId: string;
}

const INVITATION_PROJECTION = {
  listingId: 1,
  clientAccountId: 1,
  creativeAccountId: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: InvitationDocument): InvitationDTO {
  return {
    id: doc._id.toHexString(),
    listingId: doc.listingId.toHexString(),
    clientAccountId: doc.clientAccountId.toHexString(),
    creativeAccountId: doc.creativeAccountId.toHexString(),
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class InvitationRepository {
  private readonly collection: Collection<InvitationDocument>;

  constructor(db: Db) {
    this.collection = db.collection<InvitationDocument>('invitations');
  }

  async createIndexes(): Promise<void> {
    for (const index of invitationIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: CreateInvitationData): Promise<InvitationDTO> {
    const now = new Date();
    const doc: InvitationDocument = {
      _id: new ObjectId(),
      listingId: new ObjectId(input.listingId),
      clientAccountId: new ObjectId(input.clientAccountId),
      creativeAccountId: new ObjectId(input.creativeAccountId),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<InvitationDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: INVITATION_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async findByListingAndCreative(
    listingId: string,
    creativeAccountId: string,
  ): Promise<InvitationDTO | null> {
    const doc = await this.collection.findOne(
      { listingId: new ObjectId(listingId), creativeAccountId: new ObjectId(creativeAccountId) },
      { projection: INVITATION_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listByCreative(
    creativeAccountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<InvitationPage> {
    return this.listByFilter({ creativeAccountId: new ObjectId(creativeAccountId) }, params);
  }

  async updateStatus(
    id: string,
    status: InvitationStatus,
    session?: ClientSession,
  ): Promise<InvitationDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      {
        returnDocument: 'after',
        projection: INVITATION_PROJECTION,
        ...(session ? { session } : {}),
      },
    );
    return result ? toDTO(result) : null;
  }

  private async listByFilter(
    baseFilter: Filter<InvitationDocument>,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<InvitationPage> {
    const filter: Filter<InvitationDocument> = cursor
      ? { ...baseFilter, _id: { $lt: new ObjectId(cursor) } }
      : baseFilter;

    const docs = await this.collection
      .find(filter, { projection: INVITATION_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
