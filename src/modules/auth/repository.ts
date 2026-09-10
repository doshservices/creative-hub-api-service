import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { accountIndexes, type AccountDocument, type AccountType } from './model.js';
import type { AccountDTO, AccountPage } from './dto.js';

export interface AccountWithCredentials extends AccountDTO {
  passwordHash: string;
}

const ACCOUNT_FIELDS = {
  email: 1,
  firstName: 1,
  lastName: 1,
  accountType: 1,
  permissions: 1,
  status: 1,
  createdAt: 1,
} as const;

function toDTO(doc: AccountDocument): AccountDTO {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    accountType: doc.accountType,
    permissions: doc.permissions,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

export class AccountRepository {
  private readonly collection: Collection<AccountDocument>;

  constructor(db: Db) {
    this.collection = db.collection<AccountDocument>('accounts');
  }

  async createIndexes(): Promise<void> {
    for (const index of accountIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    accountType: AccountType;
    permissions: string[];
  }): Promise<AccountDTO> {
    const now = new Date();
    const doc: AccountDocument = {
      _id: new ObjectId(),
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      accountType: input.accountType,
      permissions: input.permissions,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findByEmailWithCredentials(email: string): Promise<AccountWithCredentials | null> {
    const doc = await this.collection.findOne(
      { email },
      { projection: { ...ACCOUNT_FIELDS, passwordHash: 1 } },
    );
    return doc ? { ...toDTO(doc), passwordHash: doc.passwordHash } : null;
  }

  async findById(id: string): Promise<AccountDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: ACCOUNT_FIELDS },
    );
    return doc ? toDTO(doc) : null;
  }

  // Used by the rbac module (through this module's index.ts) when a role is assigned to an
  // account — a permission change, so the caller is responsible for the audit entry CLAUDE.md
  // requires for it, not this method.
  async updatePermissions(id: string, permissions: string[]): Promise<AccountDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { permissions, updatedAt: new Date() } },
      { returnDocument: 'after', projection: ACCOUNT_FIELDS },
    );
    return result ? toDTO(result) : null;
  }

  // Password verification needs the hash but never the rest of the DTO shape — kept as its own
  // narrow method rather than widening findById's projection.
  async findCredentialsById(id: string): Promise<{ id: string; passwordHash: string } | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: { passwordHash: 1 } },
    );
    return doc ? { id: doc._id.toHexString(), passwordHash: doc.passwordHash } : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { passwordHash, updatedAt: new Date() } },
    );
  }

  // Suspend/reactivate — the caller is responsible for the audit entry, same reasoning as
  // updatePermissions above.
  async updateStatus(id: string, status: 'active' | 'suspended'): Promise<AccountDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after', projection: ACCOUNT_FIELDS },
    );
    return result ? toDTO(result) : null;
  }

  // Batch lookup for the future admin composition module (Manage Talents/Employers) — a single
  // $in query, never one findById per row.
  async findManyByIds(ids: string[]): Promise<AccountDTO[]> {
    const docs = await this.collection
      .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: ACCOUNT_FIELDS })
      .toArray();
    return docs.map(toDTO);
  }

  async list(params: {
    accountType?: AccountType;
    limit: number;
    cursor?: string;
  }): Promise<AccountPage> {
    const filter: Filter<AccountDocument> = {
      ...(params.accountType ? { accountType: params.accountType } : {}),
      ...(params.cursor ? { _id: { $lt: new ObjectId(params.cursor) } } : {}),
    };
    const docs = await this.collection
      .find(filter, { projection: ACCOUNT_FIELDS })
      .sort({ _id: -1 })
      .limit(params.limit + 1)
      .toArray();
    const hasMore = docs.length > params.limit;
    const page = docs.slice(0, params.limit);
    const last = page[page.length - 1];
    return { items: page.map(toDTO), nextCursor: hasMore && last ? last._id.toHexString() : null };
  }
}
