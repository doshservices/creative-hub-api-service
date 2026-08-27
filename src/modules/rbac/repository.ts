import type { Collection, Db, Filter } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import { roleIndexes, type RoleDocument } from './model.js';
import type { RoleDTO, RolePage } from './dto.js';

const ROLE_PROJECTION = { name: 1, permissions: 1, createdAt: 1, updatedAt: 1 } as const;

function toDTO(doc: RoleDocument): RoleDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    permissions: doc.permissions,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// A duplicate role name hit the unique index — see model.ts.
export class DuplicateRoleNameError extends Error {}

export class RoleRepository {
  private readonly collection: Collection<RoleDocument>;

  constructor(db: Db) {
    this.collection = db.collection<RoleDocument>('roles');
  }

  async createIndexes(): Promise<void> {
    for (const index of roleIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: { name: string; permissions: string[] }): Promise<RoleDTO> {
    const now = new Date();
    const doc: RoleDocument = {
      _id: new ObjectId(),
      name: input.name,
      permissions: input.permissions,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.collection.insertOne(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new DuplicateRoleNameError(input.name);
      }
      throw error;
    }
    return toDTO(doc);
  }

  async findById(id: string): Promise<RoleDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: ROLE_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async list({ limit, cursor }: { limit: number; cursor?: string }): Promise<RolePage> {
    const filter: Filter<RoleDocument> = cursor ? { _id: { $lt: new ObjectId(cursor) } } : {};
    const docs = await this.collection
      .find(filter, { projection: ROLE_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async updatePermissions(id: string, permissions: string[]): Promise<RoleDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { permissions, updatedAt: new Date() } },
      { returnDocument: 'after', projection: ROLE_PROJECTION },
    );
    return result ? toDTO(result) : null;
  }
}
