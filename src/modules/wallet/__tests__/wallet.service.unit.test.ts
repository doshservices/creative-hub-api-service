import { randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../../../common/errors.js';
import { DuplicateIdempotencyKeyError } from '../ledger.repository.js';
import { WalletService } from '../service.js';
import type {
  AuditRecorderPort,
  LedgerRepositoryPort,
  TransactionRunnerPort,
  WalletRepositoryPort,
} from '../service.js';
import type { LedgerEntryDTO, WalletDTO } from '../dto.js';

// A small in-memory fake of both repositories, backing the exact atomic-guard semantics the
// real Mongo repositories implement ($expr-filtered findOneAndUpdate) — this exercises
// WalletService's real business logic (insufficient balance, idempotent replay, hold lifecycle)
// without a real Mongo instance, per the test-suite skill's unit-test boundary.
function buildFakes() {
  const wallets = new Map<string, WalletDTO>();
  const ledgerById = new Map<string, LedgerEntryDTO>();
  const ledgerByKey = new Map<string, string>(); // `${walletId}:${idempotencyKey}` -> entry id

  const walletRepository: WalletRepositoryPort = {
    findByAccountAndCurrency(accountId, currency) {
      return Promise.resolve(
        [...wallets.values()].find((w) => w.accountId === accountId && w.currency === currency) ??
          null,
      );
    },
    findById(id) {
      return Promise.resolve(wallets.get(id) ?? null);
    },
    getOrCreate(accountId, currency) {
      const existing = [...wallets.values()].find(
        (w) => w.accountId === accountId && w.currency === currency,
      );
      if (existing) return Promise.resolve(existing);
      const wallet: WalletDTO = {
        id: randomUUID(),
        accountId,
        currency,
        balanceMinor: 0,
        heldMinor: 0,
        availableMinor: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      wallets.set(wallet.id, wallet);
      return Promise.resolve(wallet);
    },
    applyDelta(walletId, delta) {
      const wallet = wallets.get(walletId);
      if (!wallet) return Promise.resolve(null);
      const nextBalance = wallet.balanceMinor + delta.balanceDeltaMinor;
      const nextHeld = wallet.heldMinor + delta.heldDeltaMinor;
      if (nextBalance < 0 || nextHeld < 0 || nextBalance - nextHeld < 0) {
        return Promise.resolve(null);
      }
      const updated: WalletDTO = {
        ...wallet,
        balanceMinor: nextBalance,
        heldMinor: nextHeld,
        availableMinor: nextBalance - nextHeld,
        updatedAt: new Date(),
      };
      wallets.set(walletId, updated);
      return Promise.resolve(updated);
    },
    reconcile(walletId) {
      const wallet = wallets.get(walletId);
      return Promise.resolve({
        balanceMinor: wallet?.balanceMinor ?? 0,
        heldMinor: wallet?.heldMinor ?? 0,
      });
    },
  };

  const ledgerRepository: LedgerRepositoryPort = {
    create(input) {
      const key = `${input.walletId}:${input.idempotencyKey}`;
      if (ledgerByKey.has(key)) {
        throw new DuplicateIdempotencyKeyError(input.idempotencyKey);
      }
      const entry: LedgerEntryDTO = {
        id: randomUUID(),
        walletId: input.walletId,
        accountId: input.accountId,
        type: input.type,
        amountMinor: input.amountMinor,
        currency: input.currency,
        relatedEntryId: input.relatedEntryId ?? null,
        reference: input.reference ?? null,
        description: input.description ?? null,
        createdAt: new Date(),
      };
      ledgerById.set(entry.id, entry);
      ledgerByKey.set(key, entry.id);
      return Promise.resolve(entry);
    },
    findByIdempotencyKey(walletId, idempotencyKey) {
      const id = ledgerByKey.get(`${walletId}:${idempotencyKey}`);
      return Promise.resolve(id ? (ledgerById.get(id) ?? null) : null);
    },
    findById(id) {
      return Promise.resolve(ledgerById.get(id) ?? null);
    },
    findByRelatedEntryId(relatedEntryId) {
      return Promise.resolve(
        [...ledgerById.values()].filter((e) => e.relatedEntryId === relatedEntryId),
      );
    },
    listByWallet(walletId, { limit, cursor }) {
      const items = [...ledgerById.values()]
        .filter((e) => e.walletId === walletId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const startIndex = cursor ? items.findIndex((e) => e.id === cursor) + 1 : 0;
      const page = items.slice(startIndex, startIndex + limit + 1);
      const hasMore = page.length > limit;
      const pageItems = page.slice(0, limit);
      const last = pageItems[pageItems.length - 1];
      return Promise.resolve({ items: pageItems, nextCursor: hasMore && last ? last.id : null });
    },
  };

  const transactionRunner: TransactionRunnerPort = {
    withTransaction(fn) {
      return fn({} as ClientSession);
    },
  };

  const audit: AuditRecorderPort = { record: vi.fn().mockResolvedValue(undefined) };

  return { walletRepository, ledgerRepository, transactionRunner, audit };
}

function buildService() {
  const fakes = buildFakes();
  const service = new WalletService(
    fakes.walletRepository,
    fakes.ledgerRepository,
    fakes.transactionRunner,
    fakes.audit,
  );
  return { service, ...fakes };
}

describe('WalletService.credit / debit', () => {
  it('credits increase the balance and are reflected in available', async () => {
    const { service } = buildService();
    await service.credit('account-1', 'NGN', 5000, { idempotencyKey: 'credit-1' });

    const wallet = await service.getOrCreateWallet('account-1', 'NGN');
    expect(wallet.balanceMinor).toBe(5000);
    expect(wallet.availableMinor).toBe(5000);
  });

  it('rejects a debit larger than the available balance', async () => {
    const { service } = buildService();
    await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'credit-1' });

    await expect(
      service.debit('account-1', 'NGN', 2000, { idempotencyKey: 'debit-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects a non-integer or non-positive amount', async () => {
    const { service } = buildService();
    await expect(
      service.credit('account-1', 'NGN', 0, { idempotencyKey: 'k' }),
    ).rejects.toThrow();
    await expect(
      service.credit('account-1', 'NGN', 10.5, { idempotencyKey: 'k2' }),
    ).rejects.toThrow();
  });

  it('replays the same ledger entry for a repeated idempotency key instead of double-crediting', async () => {
    const { service } = buildService();
    const first = await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'same-key' });
    const second = await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'same-key' });

    expect(second.id).toBe(first.id);
    const wallet = await service.getOrCreateWallet('account-1', 'NGN');
    expect(wallet.balanceMinor).toBe(1000);
  });
});

describe('WalletService holds', () => {
  it('a hold reserves funds without changing balance, only available', async () => {
    const { service } = buildService();
    await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'credit-1' });

    await service.hold('account-1', 'NGN', 400, { idempotencyKey: 'hold-1' });

    const wallet = await service.getOrCreateWallet('account-1', 'NGN');
    expect(wallet.balanceMinor).toBe(1000);
    expect(wallet.heldMinor).toBe(400);
    expect(wallet.availableMinor).toBe(600);
  });

  it('a debit cannot spend held funds even though total balance covers it', async () => {
    const { service } = buildService();
    await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'credit-1' });
    await service.hold('account-1', 'NGN', 800, { idempotencyKey: 'hold-1' });

    await expect(
      service.debit('account-1', 'NGN', 500, { idempotencyKey: 'debit-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('releasing a hold frees the reserved amount back to available', async () => {
    const { service } = buildService();
    await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'credit-1' });
    const hold = await service.hold('account-1', 'NGN', 400, { idempotencyKey: 'hold-1' });

    await service.releaseHold(hold.id, { idempotencyKey: 'release-1' });

    const wallet = await service.getOrCreateWallet('account-1', 'NGN');
    expect(wallet.heldMinor).toBe(0);
    expect(wallet.availableMinor).toBe(1000);
  });

  it('capturing a hold moves the held amount out of the balance entirely', async () => {
    const { service } = buildService();
    await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'credit-1' });
    const hold = await service.hold('account-1', 'NGN', 400, { idempotencyKey: 'hold-1' });

    await service.captureHold(hold.id, { idempotencyKey: 'capture-1' });

    const wallet = await service.getOrCreateWallet('account-1', 'NGN');
    expect(wallet.balanceMinor).toBe(600);
    expect(wallet.heldMinor).toBe(0);
    expect(wallet.availableMinor).toBe(600);
  });

  it('rejects capturing or releasing the same hold twice', async () => {
    const { service } = buildService();
    await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'credit-1' });
    const hold = await service.hold('account-1', 'NGN', 400, { idempotencyKey: 'hold-1' });
    await service.captureHold(hold.id, { idempotencyKey: 'capture-1' });

    await expect(
      service.captureHold(hold.id, { idempotencyKey: 'capture-2' }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      service.releaseHold(hold.id, { idempotencyKey: 'release-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('WalletService.transfer', () => {
  it('moves funds atomically from one account wallet to another', async () => {
    const { service } = buildService();
    await service.credit('client-1', 'NGN', 5000, { idempotencyKey: 'fund' });

    await service.transfer('client-1', 'creative-1', 'NGN', 3000, {
      idempotencyKey: 'payout-1',
    });

    const from = await service.getOrCreateWallet('client-1', 'NGN');
    const to = await service.getOrCreateWallet('creative-1', 'NGN');
    expect(from.balanceMinor).toBe(2000);
    expect(to.balanceMinor).toBe(3000);
  });

  it('rejects a transfer larger than the sender available balance, leaving both wallets untouched', async () => {
    const { service } = buildService();
    await service.credit('client-1', 'NGN', 100, { idempotencyKey: 'fund' });

    await expect(
      service.transfer('client-1', 'creative-1', 'NGN', 3000, { idempotencyKey: 'payout-1' }),
    ).rejects.toBeInstanceOf(ConflictError);

    const from = await service.getOrCreateWallet('client-1', 'NGN');
    const to = await service.getOrCreateWallet('creative-1', 'NGN');
    expect(from.balanceMinor).toBe(100);
    expect(to.balanceMinor).toBe(0);
  });
});

describe('WalletService.reconcileWallet', () => {
  it('reports a match when the cached balance agrees with the ledger', async () => {
    const { service } = buildService();
    const wallet = await service.credit('account-1', 'NGN', 1000, { idempotencyKey: 'c1' }).then(
      async () => service.getOrCreateWallet('account-1', 'NGN'),
    );

    const result = await service.reconcileWallet(wallet.id);
    expect(result.matches).toBe(true);
  });
});
