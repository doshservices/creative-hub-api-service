import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { accountIndexes, type AccountDocument, type AccountType, type TwoFactorState } from './model.js';
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
  twoFactor: 1,
  createdAt: 1,
} as const;

const DISABLED_TWO_FACTOR: TwoFactorState = {
  enabled: false,
  secret: null,
  pendingSecret: null,
  backupCodeHashes: [],
};

function toDTO(doc: AccountDocument): AccountDTO {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    accountType: doc.accountType,
    permissions: doc.permissions,
    status: doc.status,
    twoFactorEnabled: doc.twoFactor.enabled,
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
      twoFactor: { ...DISABLED_TWO_FACTOR },
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

  // Narrow projection for the 2FA setup/login flows — never widen findById's projection just
  // for this, same reasoning as findCredentialsById.
  async findTwoFactorStateById(id: string): Promise<TwoFactorState | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: { twoFactor: 1 } },
    );
    return doc ? doc.twoFactor : null;
  }

  // POST /auth/2fa/setup — the secret isn't active until enableTwoFactor confirms a code
  // against it, so it lands in `pendingSecret`, not `secret`.
  async setPendingTwoFactorSecret(id: string, pendingSecret: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { 'twoFactor.pendingSecret': pendingSecret, updatedAt: new Date() } },
    );
  }

  // POST /auth/2fa/enable — promotes the confirmed pending secret and stores the backup code
  // hashes generated alongside it. The caller is responsible for the audit entry.
  async activateTwoFactor(id: string, secret: string, backupCodeHashes: string[]): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          'twoFactor.enabled': true,
          'twoFactor.secret': secret,
          'twoFactor.pendingSecret': null,
          'twoFactor.backupCodeHashes': backupCodeHashes,
          updatedAt: new Date(),
        },
      },
    );
  }

  // POST /auth/2fa/disable — resets to the same disabled state a brand-new account starts in.
  async deactivateTwoFactor(id: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { twoFactor: { ...DISABLED_TWO_FACTOR }, updatedAt: new Date() } },
    );
  }

  // A backup code is single-use — $pull removes exactly the redeemed hash so it can never be
  // replayed, without needing a read-modify-write race on the array.
  async removeBackupCodeHash(id: string, hash: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $pull: { 'twoFactor.backupCodeHashes': hash }, $set: { updatedAt: new Date() } },
    );
  }

  // Batch lookup for the future admin composition module (Manage Talents/Employers) — a single
  // $in query, never one findById per row.
  async findManyByIds(ids: string[]): Promise<AccountDTO[]> {
    const docs = await this.collection
      .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: ACCOUNT_FIELDS })
      .toArray();
    return docs.map(toDTO);
  }

  // Cheap total count for the admin composition module's stats endpoint — `list()` alone can't
  // give a total without walking every page. A plain countDocuments, not an aggregation.
  async count(accountType?: AccountType): Promise<number> {
    const filter: Filter<AccountDocument> = accountType ? { accountType } : {};
    return this.collection.countDocuments(filter);
  }

  // Signups-per-day for the admin composition module's timeseries stat — one $group-by-day
  // aggregation over the requested range, never a loop of per-day countDocuments calls. Bucketed
  // by UTC calendar day via $dateToString, matching how the rest of this codebase treats
  // createdAt ranges (see wallet's ledger.repository.ts listAll).
  async countByDayForRange(params: {
    from: Date;
    to: Date;
    accountType?: AccountType;
  }): Promise<Array<{ date: string; count: number }>> {
    const match: Filter<AccountDocument> = {
      createdAt: { $gte: params.from, $lte: params.to },
      ...(params.accountType ? { accountType: params.accountType } : {}),
    };
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
    ];
    const rows = await this.collection
      .aggregate<{ _id: string; count: number }>(pipeline)
      .toArray();
    return rows.map((row) => ({ date: row._id, count: row.count }));
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
