import type { ClientSession } from 'mongodb';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors.js';
import { DuplicateIdempotencyKeyError } from './ledger.repository.js';
import type { LedgerEntryDTO, LedgerPage, WalletDTO } from './dto.js';
import type { LedgerEntryType } from './ledger.model.js';

export const DEFAULT_CURRENCY = 'NGN';

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface MovementOptions {
  idempotencyKey: string;
  reference?: string;
  description?: string;
}

export interface WalletRepositoryPort {
  findByAccountAndCurrency(accountId: string, currency: string): Promise<WalletDTO | null>;
  findById(id: string): Promise<WalletDTO | null>;
  getOrCreate(accountId: string, currency: string): Promise<WalletDTO>;
  applyDelta(
    walletId: string,
    delta: { balanceDeltaMinor: number; heldDeltaMinor: number },
    session: ClientSession,
  ): Promise<WalletDTO | null>;
  reconcile(walletId: string): Promise<{ balanceMinor: number; heldMinor: number }>;
}

export interface LedgerRepositoryPort {
  create(
    input: {
      walletId: string;
      accountId: string;
      type: LedgerEntryType;
      amountMinor: number;
      currency: string;
      idempotencyKey: string;
      relatedEntryId?: string;
      reference?: string;
      description?: string;
    },
    session: ClientSession,
  ): Promise<LedgerEntryDTO>;
  findByIdempotencyKey(walletId: string, idempotencyKey: string): Promise<LedgerEntryDTO | null>;
  findById(id: string): Promise<LedgerEntryDTO | null>;
  findByRelatedEntryId(relatedEntryId: string): Promise<LedgerEntryDTO[]>;
  listByWallet(walletId: string, params: PageParams): Promise<LedgerPage>;
}

export interface TransactionRunnerPort {
  withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T>;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
}

function assertPositiveInteger(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new BadRequestError('amountMinor must be a positive integer');
  }
}

export class WalletService {
  constructor(
    private readonly wallets: WalletRepositoryPort,
    private readonly ledger: LedgerRepositoryPort,
    private readonly transactions: TransactionRunnerPort,
    private readonly audit: AuditRecorderPort,
  ) {}

  async getOrCreateWallet(accountId: string, currency = DEFAULT_CURRENCY): Promise<WalletDTO> {
    return this.wallets.getOrCreate(accountId, currency);
  }

  async listLedger(
    accountId: string,
    currency: string,
    params: PageParams,
  ): Promise<LedgerPage> {
    const wallet = await this.wallets.getOrCreate(accountId, currency);
    return this.ledger.listByWallet(wallet.id, params);
  }

  // Every ledger-writing operation (credit/debit/hold) funnels through here: idempotency
  // pre-check, then an atomic balance delta + ledger insert in one transaction, with the
  // unique-index race caught and resolved to the existing entry — see the money-and-ledger
  // skill and ledger.repository.ts's DuplicateIdempotencyKeyError.
  private async recordMovement(
    walletId: string,
    accountId: string,
    type: LedgerEntryType,
    amountMinor: number,
    delta: { balanceDeltaMinor: number; heldDeltaMinor: number },
    options: MovementOptions,
    relatedEntryId?: string,
  ): Promise<LedgerEntryDTO> {
    const existing = await this.ledger.findByIdempotencyKey(walletId, options.idempotencyKey);
    if (existing) {
      // No new movement happened — an idempotent replay of an already-recorded entry is not a
      // fresh event worth auditing again.
      return existing;
    }

    try {
      const entry = await this.transactions.withTransaction(async (session) => {
        const updated = await this.wallets.applyDelta(walletId, delta, session);
        if (!updated) {
          throw new ConflictError('Insufficient available balance');
        }
        return this.ledger.create(
          {
            walletId,
            accountId,
            type,
            amountMinor,
            currency: updated.currency,
            idempotencyKey: options.idempotencyKey,
            ...(relatedEntryId ? { relatedEntryId } : {}),
            ...(options.reference !== undefined ? { reference: options.reference } : {}),
            ...(options.description !== undefined ? { description: options.description } : {}),
          },
          session,
        );
      });
      // Every wallet movement is audit-required per CLAUDE.md — written after the transaction
      // commits, since the audit trail and the ledger are deliberately separate tables (see the
      // money-and-ledger skill).
      await this.audit.record({
        actorId: accountId,
        action: `wallet.${type}`,
        targetType: 'ledgerEntry',
        targetId: entry.id,
      });
      return entry;
    } catch (error) {
      if (error instanceof DuplicateIdempotencyKeyError) {
        const winner = await this.ledger.findByIdempotencyKey(walletId, options.idempotencyKey);
        if (winner) return winner;
      }
      throw error;
    }
  }

  async credit(
    accountId: string,
    currency: string,
    amountMinor: number,
    options: MovementOptions,
  ): Promise<LedgerEntryDTO> {
    assertPositiveInteger(amountMinor);
    const wallet = await this.wallets.getOrCreate(accountId, currency);
    return this.recordMovement(
      wallet.id,
      accountId,
      'credit',
      amountMinor,
      { balanceDeltaMinor: amountMinor, heldDeltaMinor: 0 },
      options,
    );
  }

  async debit(
    accountId: string,
    currency: string,
    amountMinor: number,
    options: MovementOptions,
  ): Promise<LedgerEntryDTO> {
    assertPositiveInteger(amountMinor);
    const wallet = await this.wallets.getOrCreate(accountId, currency);
    return this.recordMovement(
      wallet.id,
      accountId,
      'debit',
      amountMinor,
      { balanceDeltaMinor: -amountMinor, heldDeltaMinor: 0 },
      options,
    );
  }

  async hold(
    accountId: string,
    currency: string,
    amountMinor: number,
    options: MovementOptions,
  ): Promise<LedgerEntryDTO> {
    assertPositiveInteger(amountMinor);
    const wallet = await this.wallets.getOrCreate(accountId, currency);
    return this.recordMovement(
      wallet.id,
      accountId,
      'hold',
      amountMinor,
      { balanceDeltaMinor: 0, heldDeltaMinor: amountMinor },
      options,
    );
  }

  async releaseHold(holdEntryId: string, options: MovementOptions): Promise<LedgerEntryDTO> {
    const hold = await this.loadOpenHold(holdEntryId);
    return this.recordMovement(
      hold.walletId,
      hold.accountId,
      'hold_release',
      hold.amountMinor,
      { balanceDeltaMinor: 0, heldDeltaMinor: -hold.amountMinor },
      options,
      hold.id,
    );
  }

  // Full capture only: the held amount moves from "reserved" to "actually spent" in one step.
  // Partial capture (releasing the remainder) is not implemented — flagging per the
  // third-party-provider/money-and-ledger skills' "say so rather than silently skipping" rule.
  async captureHold(holdEntryId: string, options: MovementOptions): Promise<LedgerEntryDTO> {
    const hold = await this.loadOpenHold(holdEntryId);
    return this.recordMovement(
      hold.walletId,
      hold.accountId,
      'hold_capture',
      hold.amountMinor,
      { balanceDeltaMinor: -hold.amountMinor, heldDeltaMinor: -hold.amountMinor },
      options,
      hold.id,
    );
  }

  private async loadOpenHold(holdEntryId: string): Promise<LedgerEntryDTO> {
    const hold = await this.ledger.findById(holdEntryId);
    if (!hold || hold.type !== 'hold') {
      throw new NotFoundError('Hold not found');
    }
    const resolutions = await this.ledger.findByRelatedEntryId(hold.id);
    if (resolutions.length > 0) {
      throw new ConflictError('This hold has already been released or captured');
    }
    return hold;
  }

  // Atomic wallet-to-wallet transfer (e.g. escrow payout): both legs commit in one transaction
  // or neither does. Exposed for other modules (payments, hiring) to call through this module's
  // index.ts — never by writing to the wallets/ledgerEntries collections directly.
  async transfer(
    fromAccountId: string,
    toAccountId: string,
    currency: string,
    amountMinor: number,
    options: MovementOptions,
  ): Promise<{ debit: LedgerEntryDTO; credit: LedgerEntryDTO }> {
    assertPositiveInteger(amountMinor);
    const [fromWallet, toWallet] = await Promise.all([
      this.wallets.getOrCreate(fromAccountId, currency),
      this.wallets.getOrCreate(toAccountId, currency),
    ]);

    const debitKey = `${options.idempotencyKey}:debit`;
    const creditKey = `${options.idempotencyKey}:credit`;

    const existingDebit = await this.ledger.findByIdempotencyKey(fromWallet.id, debitKey);
    const existingCredit = await this.ledger.findByIdempotencyKey(toWallet.id, creditKey);
    if (existingDebit && existingCredit) {
      return { debit: existingDebit, credit: existingCredit };
    }

    try {
      const result = await this.transactions.withTransaction(async (session) => {
        const debitedWallet = await this.wallets.applyDelta(
          fromWallet.id,
          { balanceDeltaMinor: -amountMinor, heldDeltaMinor: 0 },
          session,
        );
        if (!debitedWallet) {
          throw new ConflictError('Insufficient available balance');
        }
        const debit = await this.ledger.create(
          {
            walletId: fromWallet.id,
            accountId: fromAccountId,
            type: 'debit',
            amountMinor,
            currency,
            idempotencyKey: debitKey,
            ...(options.reference !== undefined ? { reference: options.reference } : {}),
            ...(options.description !== undefined ? { description: options.description } : {}),
          },
          session,
        );

        const creditedWallet = await this.wallets.applyDelta(
          toWallet.id,
          { balanceDeltaMinor: amountMinor, heldDeltaMinor: 0 },
          session,
        );
        if (!creditedWallet) {
          throw new ConflictError('Transfer failed');
        }
        const credit = await this.ledger.create(
          {
            walletId: toWallet.id,
            accountId: toAccountId,
            type: 'credit',
            amountMinor,
            currency,
            idempotencyKey: creditKey,
            relatedEntryId: debit.id,
            ...(options.reference !== undefined ? { reference: options.reference } : {}),
            ...(options.description !== undefined ? { description: options.description } : {}),
          },
          session,
        );

        return { debit, credit };
      });

      // Both legs are audit-required wallet movements (CLAUDE.md) — recorded once per affected
      // account after the transaction commits.
      await this.audit.record({
        actorId: fromAccountId,
        action: 'wallet.transfer_debit',
        targetType: 'ledgerEntry',
        targetId: result.debit.id,
      });
      await this.audit.record({
        actorId: toAccountId,
        action: 'wallet.transfer_credit',
        targetType: 'ledgerEntry',
        targetId: result.credit.id,
      });
      return result;
    } catch (error) {
      if (error instanceof DuplicateIdempotencyKeyError) {
        const debit = await this.ledger.findByIdempotencyKey(fromWallet.id, debitKey);
        const credit = await this.ledger.findByIdempotencyKey(toWallet.id, creditKey);
        if (debit && credit) return { debit, credit };
      }
      throw error;
    }
  }

  // Recomputes balance/held from the ledger and reports whether the materialized cache on the
  // wallet document agrees — a reconciliation check, not a repair; see the money-and-ledger skill.
  async reconcileWallet(
    walletId: string,
  ): Promise<{ matches: boolean; cached: WalletDTO; computed: { balanceMinor: number; heldMinor: number } }> {
    const cached = await this.wallets.findById(walletId);
    if (!cached) {
      throw new NotFoundError('Wallet not found');
    }
    const computed = await this.wallets.reconcile(walletId);
    const matches =
      cached.balanceMinor === computed.balanceMinor && cached.heldMinor === computed.heldMinor;
    return { matches, cached, computed };
  }
}
