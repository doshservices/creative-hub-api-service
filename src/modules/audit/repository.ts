import type { Collection, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { auditEntryIndexes, type AuditEntryDocument } from './model.js';
import type { AuditEntryDTO } from './dto.js';

export interface CreateAuditEntryInput {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

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
}
