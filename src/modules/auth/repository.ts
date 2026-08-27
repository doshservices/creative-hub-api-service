import type { Collection, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { accountIndexes, type AccountDocument, type AccountType } from './model.js';
import type { AccountDTO } from './dto.js';

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
}
