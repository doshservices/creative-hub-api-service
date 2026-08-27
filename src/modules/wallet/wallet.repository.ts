import type { ClientSession, Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { walletIndexes, type WalletDocument } from './wallet.model.js';
import type { WalletDTO } from './dto.js';

const WALLET_PROJECTION = {
  accountId: 1,
  currency: 1,
  balanceMinor: 1,
  heldMinor: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: WalletDocument): WalletDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    currency: doc.currency,
    balanceMinor: doc.balanceMinor,
    heldMinor: doc.heldMinor,
    availableMinor: doc.balanceMinor - doc.heldMinor,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface BalanceDelta {
  balanceDeltaMinor: number;
  heldDeltaMinor: number;
}

export class WalletRepository {
  private readonly collection: Collection<WalletDocument>;
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<WalletDocument>('wallets');
  }

  async createIndexes(): Promise<void> {
    for (const index of walletIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async findByAccountAndCurrency(accountId: string, currency: string): Promise<WalletDTO | null> {
    const doc = await this.collection.findOne(
      { accountId: new ObjectId(accountId), currency },
      { projection: WALLET_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async findById(id: string): Promise<WalletDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: WALLET_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  // Atomic upsert: concurrent first-access from the same account/currency race to the same
  // document instead of one of them throwing a duplicate-key error on the unique index.
  async getOrCreate(accountId: string, currency: string): Promise<WalletDTO> {
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { accountId: new ObjectId(accountId), currency },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          accountId: new ObjectId(accountId),
          currency,
          balanceMinor: 0,
          heldMinor: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: 'after', projection: WALLET_PROJECTION },
    );
    // findOneAndUpdate with upsert always returns a document in modern driver versions.
    return toDTO(result as WalletDocument);
  }

  // Applies both deltas in one atomic update, only when the result would leave balanceMinor,
  // heldMinor, and availableMinor (balance - held) all non-negative — the $expr filter is the
  // actual race guard, not a caller pre-check. A pure debit (heldDeltaMinor: 0) is therefore
  // bounded by *available* balance, not total balance, so held/reserved funds can't be spent.
  // Returns null to signal the update was rejected (insufficient balance or hold) rather than
  // throwing, so the service can turn that into a domain error.
  async applyDelta(
    walletId: string,
    delta: BalanceDelta,
    session: ClientSession,
  ): Promise<WalletDTO | null> {
    const filter: Filter<WalletDocument> = {
      _id: new ObjectId(walletId),
      $expr: {
        $and: [
          { $gte: [{ $add: ['$balanceMinor', delta.balanceDeltaMinor] }, 0] },
          { $gte: [{ $add: ['$heldMinor', delta.heldDeltaMinor] }, 0] },
          {
            $gte: [
              {
                $subtract: [
                  { $add: ['$balanceMinor', delta.balanceDeltaMinor] },
                  { $add: ['$heldMinor', delta.heldDeltaMinor] },
                ],
              },
              0,
            ],
          },
        ],
      },
    };

    const result = await this.collection.findOneAndUpdate(
      filter,
      {
        $inc: { balanceMinor: delta.balanceDeltaMinor, heldMinor: delta.heldDeltaMinor },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after', projection: WALLET_PROJECTION, session },
    );
    return result ? toDTO(result) : null;
  }

  // Recomputes balance/held straight from the ledger — used to verify the materialized cache
  // hasn't drifted, per the money-and-ledger skill's reconciliation requirement.
  async reconcile(walletId: string): Promise<{ balanceMinor: number; heldMinor: number }> {
    const pipeline = [
      { $match: { walletId: new ObjectId(walletId) } },
      {
        $group: {
          _id: null,
          balanceMinor: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ['$type', 'credit'] }, then: '$amountMinor' },
                  { case: { $eq: ['$type', 'debit'] }, then: { $multiply: ['$amountMinor', -1] } },
                  {
                    case: { $eq: ['$type', 'hold_capture'] },
                    then: { $multiply: ['$amountMinor', -1] },
                  },
                ],
                default: 0,
              },
            },
          },
          heldMinor: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ['$type', 'hold'] }, then: '$amountMinor' },
                  {
                    case: { $eq: ['$type', 'hold_release'] },
                    then: { $multiply: ['$amountMinor', -1] },
                  },
                  {
                    case: { $eq: ['$type', 'hold_capture'] },
                    then: { $multiply: ['$amountMinor', -1] },
                  },
                ],
                default: 0,
              },
            },
          },
        },
      },
    ];
    const [result] = await this.db
      .collection('ledgerEntries')
      .aggregate<{ balanceMinor: number; heldMinor: number }>(pipeline)
      .toArray();
    return result ?? { balanceMinor: 0, heldMinor: 0 };
  }
}
