import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { auditEntryIndexes, type AuditEntryDocument } from './model.js';
import type { AuditEntryDTO, AuditEntryPage } from './dto.js';

export interface CreateAuditEntryInput {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEntryListParams {
  limit: number;
  cursor?: string;
  action?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
}

const AUDIT_ENTRY_PROJECTION = {
  actorId: 1,
  action: 1,
  targetType: 1,
  targetId: 1,
  metadata: 1,
  createdAt: 1,
} as const;

function toDTO(doc: AuditEntryDocument): AuditEntryDTO {
  return {
    id: doc._id.toHexString(),
    actorId: doc.actorId.toHexString(),
    action: doc.action,
    targetType: doc.targetType,
    targetId: doc.targetId,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
  };
}

export class AuditRepository {
  private readonly collection: Collection<AuditEntryDocument>;

  constructor(db: Db) {
    this.collection = db.collection<AuditEntryDocument>('auditEntries');
  }

  async createIndexes(): Promise<void> {
    for (const index of auditEntryIndexes) {
      await this.collection.createIndex(index.key, { name: index.name });
    }
  }

  async create(input: CreateAuditEntryInput): Promise<AuditEntryDTO> {
    const doc: AuditEntryDocument = {
      _id: new ObjectId(),
      actorId: new ObjectId(input.actorId),
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  // Admin audit-log viewer (GET /admin/audit) — read-only, no update/delete method exists on
  // this repository at all: audit rows are append-only per CLAUDE.md.
  async list(params: AuditEntryListParams): Promise<AuditEntryPage> {
    const filter: Filter<AuditEntryDocument> = {
      ...(params.action ? { action: params.action } : {}),
      ...(params.actorId ? { actorId: new ObjectId(params.actorId) } : {}),
      ...(params.cursor ? { _id: { $lt: new ObjectId(params.cursor) } } : {}),
    };
    if (params.from || params.to) {
      filter.createdAt = {
        ...(params.from ? { $gte: params.from } : {}),
        ...(params.to ? { $lte: params.to } : {}),
      };
    }

    const docs = await this.collection
      .find(filter, { projection: AUDIT_ENTRY_PROJECTION })
      .sort({ _id: -1 })
      .limit(params.limit + 1)
      .toArray();

    const hasMore = docs.length > params.limit;
    const items = docs.slice(0, params.limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
