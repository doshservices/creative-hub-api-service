import { describe, expect, it, vi } from 'vitest';
import {
  processReconcileSweep,
  RECONCILE_STALE_THRESHOLD_MS,
  type DepositProcessingRepositoryPort,
  type PaymentsWorkerDeps,
  type ReconcileDispatchPort,
  type WithdrawalProcessingRepositoryPort,
} from '../queue.js';

// Fakes only the two methods the sweep actually calls on each port — the rest of
// PaymentsWorkerDeps (accounts, flutterwave, service, depositRedirectUrl) is irrelevant to the
// sweep's own selection/dispatch logic, which is what this test targets. Full end-to-end
// behavior (real Mongo query + real completion) is covered by the integration test.
function buildDeps(overrides: {
  deposits?: Partial<DepositProcessingRepositoryPort>;
  withdrawals?: Partial<WithdrawalProcessingRepositoryPort>;
  reconcile?: Partial<ReconcileDispatchPort>;
} = {}): PaymentsWorkerDeps & { reconcile: ReconcileDispatchPort } {
  const deposits: DepositProcessingRepositoryPort = {
    findById: vi.fn().mockResolvedValue(null),
    findStaleAwaitingPayment: vi.fn().mockResolvedValue([]),
    ...overrides.deposits,
  };
  const withdrawals: WithdrawalProcessingRepositoryPort = {
    findForProcessing: vi.fn().mockResolvedValue(null),
    findStaleProcessing: vi.fn().mockResolvedValue([]),
    ...overrides.withdrawals,
  };
  const reconcile: ReconcileDispatchPort = {
    enqueueReconcileDeposit: vi.fn().mockResolvedValue(undefined),
    enqueueReconcileWithdrawal: vi.fn().mockResolvedValue(undefined),
    ...overrides.reconcile,
  };

  return {
    deposits,
    withdrawals,
    reconcile,
    accounts: { findById: vi.fn() },
    flutterwave: {
      initiatePayment: vi.fn(),
      verifyTransaction: vi.fn(),
      initiateTransfer: vi.fn(),
      verifyTransfer: vi.fn(),
    },
    service: {
      applyDepositInitiation: vi.fn(),
      applyDepositVerification: vi.fn(),
      applyWithdrawalInitiation: vi.fn(),
      applyWithdrawalVerification: vi.fn(),
    },
    depositRedirectUrl: 'https://example.com/payments/callback',
  };
}

describe('processReconcileSweep', () => {
  it('does nothing when no records are stale', async () => {
    const deps = buildDeps();
    await processReconcileSweep({}, deps);
    expect(deps.reconcile.enqueueReconcileDeposit).not.toHaveBeenCalled();
    expect(deps.reconcile.enqueueReconcileWithdrawal).not.toHaveBeenCalled();
  });

  it('enqueues reconcile-deposit for every stale awaiting_payment deposit found', async () => {
    const deps = buildDeps({
      deposits: {
        findStaleAwaitingPayment: vi.fn().mockResolvedValue([
          { id: 'deposit-1', providerTransactionId: 'flw-tx-1' },
          { id: 'deposit-2', providerTransactionId: 'flw-tx-2' },
        ]),
      },
    });

    await processReconcileSweep({}, deps);

    expect(deps.reconcile.enqueueReconcileDeposit).toHaveBeenCalledTimes(2);
    expect(deps.reconcile.enqueueReconcileDeposit).toHaveBeenCalledWith('deposit-1', 'flw-tx-1');
    expect(deps.reconcile.enqueueReconcileDeposit).toHaveBeenCalledWith('deposit-2', 'flw-tx-2');
  });

  it('enqueues reconcile-withdrawal for every stale processing withdrawal found', async () => {
    const deps = buildDeps({
      withdrawals: {
        findStaleProcessing: vi
          .fn()
          .mockResolvedValue([{ id: 'withdrawal-1', providerTransferId: 'flw-transfer-1' }]),
      },
    });

    await processReconcileSweep({}, deps);

    expect(deps.reconcile.enqueueReconcileWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      'flw-transfer-1',
    );
  });

  it('queries using a cutoff RECONCILE_STALE_THRESHOLD_MS in the past', async () => {
    const before = Date.now();
    const deps = buildDeps();
    await processReconcileSweep({}, deps);
    const after = Date.now();

    const [cutoff] = (deps.deposits.findStaleAwaitingPayment as ReturnType<typeof vi.fn>).mock
      .calls[0] as [Date];
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - RECONCILE_STALE_THRESHOLD_MS);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - RECONCILE_STALE_THRESHOLD_MS);

    const [withdrawalCutoff] = (deps.withdrawals.findStaleProcessing as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [Date];
    expect(withdrawalCutoff.getTime()).toEqual(cutoff.getTime());
  });
});
