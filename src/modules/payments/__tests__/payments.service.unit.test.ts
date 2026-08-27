import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../common/errors.js';
import { PaymentsService } from '../service.js';
import type {
  AuditRecorderPort,
  DepositRepositoryPort,
  PaymentsQueuePort,
  WalletMovementPort,
  WithdrawalRepositoryPort,
} from '../service.js';
import type { DepositDTO, WithdrawalDTO } from '../dto.js';

function buildDeposit(overrides: Partial<DepositDTO> = {}): DepositDTO {
  return {
    id: 'deposit-1',
    accountId: 'account-1',
    amountMinor: 5000,
    currency: 'NGN',
    txRef: 'dep_abc',
    checkoutUrl: null,
    status: 'pending',
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildWithdrawal(overrides: Partial<WithdrawalDTO> = {}): WithdrawalDTO {
  return {
    id: 'withdrawal-1',
    accountId: 'account-1',
    amountMinor: 3000,
    currency: 'NGN',
    reference: 'wd_abc',
    bankCode: '044',
    accountNumber: '0123456789',
    status: 'pending',
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  deposits?: Partial<DepositRepositoryPort>;
  withdrawals?: Partial<WithdrawalRepositoryPort>;
  wallet?: Partial<WalletMovementPort>;
  queue?: Partial<PaymentsQueuePort>;
  audit?: Partial<AuditRecorderPort>;
} = {}) {
  const deposits: DepositRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildDeposit()),
    findById: vi.fn().mockResolvedValue(buildDeposit()),
    findByTxRef: vi.fn().mockResolvedValue(buildDeposit()),
    listForAccount: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    setCheckoutUrl: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides.deposits,
  };
  const withdrawals: WithdrawalRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildWithdrawal()),
    findById: vi.fn().mockResolvedValue(buildWithdrawal()),
    findByReference: vi.fn().mockResolvedValue(buildWithdrawal()),
    findHoldEntryId: vi.fn().mockResolvedValue('hold-1'),
    listForAccount: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    markProcessing: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides.withdrawals,
  };
  const wallet: WalletMovementPort = {
    hold: vi.fn().mockResolvedValue({ id: 'hold-1' }),
    credit: vi.fn().mockResolvedValue(undefined),
    releaseHold: vi.fn().mockResolvedValue(undefined),
    captureHold: vi.fn().mockResolvedValue(undefined),
    ...overrides.wallet,
  };
  const queue: PaymentsQueuePort = {
    enqueueInitiateDeposit: vi.fn().mockResolvedValue(undefined),
    enqueueReconcileDeposit: vi.fn().mockResolvedValue(undefined),
    enqueueInitiateWithdrawal: vi.fn().mockResolvedValue(undefined),
    enqueueReconcileWithdrawal: vi.fn().mockResolvedValue(undefined),
    ...overrides.queue,
  };
  const audit: AuditRecorderPort = { record: vi.fn().mockResolvedValue(undefined), ...overrides.audit };

  const service = new PaymentsService(deposits, withdrawals, wallet, queue, audit);
  return { service, deposits, withdrawals, wallet, queue, audit };
}

describe('PaymentsService.initiateDeposit', () => {
  it('rejects a non-positive-integer amount', async () => {
    const { service } = buildService();
    await expect(service.initiateDeposit('account-1', { amountMinor: 0 })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('creates the deposit and enqueues initiation', async () => {
    const { service, deposits, queue } = buildService();
    await service.initiateDeposit('account-1', { amountMinor: 5000 });

    expect(deposits.create).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'account-1', amountMinor: 5000, currency: 'NGN' }),
    );
    expect(queue.enqueueInitiateDeposit).toHaveBeenCalledWith('deposit-1');
  });
});

describe('PaymentsService.getMyDeposit', () => {
  it('throws NotFoundError when the deposit does not exist', async () => {
    const { service } = buildService({ deposits: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(service.getMyDeposit('account-1', 'deposit-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ForbiddenError for another account's deposit", async () => {
    const { service } = buildService();
    await expect(service.getMyDeposit('someone-else', 'deposit-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('PaymentsService.initiateWithdrawal', () => {
  it('places a wallet hold before creating the withdrawal record', async () => {
    const { service, wallet, withdrawals, queue } = buildService();

    await service.initiateWithdrawal('account-1', {
      amountMinor: 3000,
      bankCode: '044',
      accountNumber: '0123456789',
    });

    expect(wallet.hold).toHaveBeenCalledWith(
      'account-1',
      'NGN',
      3000,
      expect.objectContaining({ idempotencyKey: expect.stringContaining('withdrawal:') }),
    );
    expect(withdrawals.create).toHaveBeenCalledWith(
      expect.objectContaining({ holdEntryId: 'hold-1' }),
    );
    expect(queue.enqueueInitiateWithdrawal).toHaveBeenCalledWith('withdrawal-1');
  });

  it('propagates an insufficient-balance hold failure without creating a record', async () => {
    const holdError = new Error('Insufficient available balance');
    const { service, withdrawals } = buildService({
      wallet: { hold: vi.fn().mockRejectedValue(holdError) },
    });

    await expect(
      service.initiateWithdrawal('account-1', {
        amountMinor: 3000,
        bankCode: '044',
        accountNumber: '0123456789',
      }),
    ).rejects.toThrow(holdError);
    expect(withdrawals.create).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.handleChargeCompleted / handleTransferCompleted', () => {
  it('enqueues reconciliation only when the deposit is found', async () => {
    const { service, queue } = buildService();
    await service.handleChargeCompleted('dep_abc', 'flw-tx-1');
    expect(queue.enqueueReconcileDeposit).toHaveBeenCalledWith('deposit-1', 'flw-tx-1');
  });

  it('does nothing for an unknown tx_ref', async () => {
    const { service, queue } = buildService({
      deposits: { findByTxRef: vi.fn().mockResolvedValue(null) },
    });
    await service.handleChargeCompleted('unknown', 'flw-tx-1');
    expect(queue.enqueueReconcileDeposit).not.toHaveBeenCalled();
  });

  it('enqueues withdrawal reconciliation only when found', async () => {
    const { service, queue } = buildService();
    await service.handleTransferCompleted('wd_abc', 'flw-transfer-1');
    expect(queue.enqueueReconcileWithdrawal).toHaveBeenCalledWith('withdrawal-1', 'flw-transfer-1');
  });
});

describe('PaymentsService.applyDepositInitiation', () => {
  it('marks the deposit failed on a definitive rejection', async () => {
    const { service, deposits } = buildService();
    await service.applyDepositInitiation('deposit-1', { status: 'rejected', reason: 'bad request' });
    expect(deposits.markFailed).toHaveBeenCalledWith('deposit-1', 'bad request');
  });

  it('stores the checkout url on acceptance', async () => {
    const { service, deposits } = buildService();
    await service.applyDepositInitiation('deposit-1', {
      status: 'accepted',
      checkoutUrl: 'https://checkout.flutterwave.com/x',
    });
    expect(deposits.setCheckoutUrl).toHaveBeenCalledWith(
      'deposit-1',
      'https://checkout.flutterwave.com/x',
    );
  });
});

describe('PaymentsService.applyDepositVerification', () => {
  it('is a no-op once the deposit is already completed', async () => {
    const { service, wallet } = buildService({
      deposits: { findById: vi.fn().mockResolvedValue(buildDeposit({ status: 'completed' })) },
    });
    await service.applyDepositVerification('deposit-1', 'flw-tx-1', {
      status: 'successful',
      amountMinor: 5000,
      currency: 'NGN',
    });
    expect(wallet.credit).not.toHaveBeenCalled();
  });

  it('marks failed when the provider reports failure', async () => {
    const { service, deposits, wallet } = buildService();
    await service.applyDepositVerification('deposit-1', 'flw-tx-1', {
      status: 'failed',
      amountMinor: 5000,
      currency: 'NGN',
    });
    expect(deposits.markFailed).toHaveBeenCalledWith('deposit-1', 'Payment failed at provider');
    expect(wallet.credit).not.toHaveBeenCalled();
  });

  it('marks failed instead of crediting when the verified amount does not match', async () => {
    const { service, deposits, wallet } = buildService();
    await service.applyDepositVerification('deposit-1', 'flw-tx-1', {
      status: 'successful',
      amountMinor: 1,
      currency: 'NGN',
    });
    expect(wallet.credit).not.toHaveBeenCalled();
    expect(deposits.markFailed).toHaveBeenCalledWith(
      'deposit-1',
      expect.stringContaining('did not match'),
    );
  });

  it('credits the wallet, marks completed, and audits on a matching successful verification', async () => {
    const { service, deposits, wallet, audit } = buildService();
    await service.applyDepositVerification('deposit-1', 'flw-tx-1', {
      status: 'successful',
      amountMinor: 5000,
      currency: 'NGN',
    });
    expect(wallet.credit).toHaveBeenCalledWith(
      'account-1',
      'NGN',
      5000,
      expect.objectContaining({ idempotencyKey: 'deposit:deposit-1' }),
    );
    expect(deposits.markCompleted).toHaveBeenCalledWith('deposit-1', 'flw-tx-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payments.deposit_completed', targetId: 'deposit-1' }),
    );
  });
});

describe('PaymentsService.applyWithdrawalInitiation', () => {
  it('marks processing on acceptance', async () => {
    const { service, withdrawals } = buildService();
    await service.applyWithdrawalInitiation('withdrawal-1', {
      status: 'accepted',
      providerTransferId: 'flw-transfer-1',
    });
    expect(withdrawals.markProcessing).toHaveBeenCalledWith('withdrawal-1', 'flw-transfer-1');
  });

  it('releases the hold and marks failed on a definitive rejection', async () => {
    const { service, withdrawals, wallet, audit } = buildService();
    await service.applyWithdrawalInitiation('withdrawal-1', {
      status: 'rejected',
      reason: 'invalid account number',
    });
    expect(wallet.releaseHold).toHaveBeenCalledWith(
      'hold-1',
      expect.objectContaining({ idempotencyKey: 'withdrawal:wd_abc:release' }),
    );
    expect(withdrawals.markFailed).toHaveBeenCalledWith('withdrawal-1', 'invalid account number');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payments.withdrawal_failed' }),
    );
  });
});

describe('PaymentsService.applyWithdrawalVerification', () => {
  it('is a no-op once already resolved', async () => {
    const { service, wallet } = buildService({
      withdrawals: { findById: vi.fn().mockResolvedValue(buildWithdrawal({ status: 'failed' })) },
    });
    await service.applyWithdrawalVerification('withdrawal-1', { status: 'successful' });
    expect(wallet.captureHold).not.toHaveBeenCalled();
  });

  it('captures the hold, marks completed, and audits on success', async () => {
    const { service, withdrawals, wallet, audit } = buildService();
    await service.applyWithdrawalVerification('withdrawal-1', { status: 'successful' });

    expect(wallet.captureHold).toHaveBeenCalledWith(
      'hold-1',
      expect.objectContaining({ idempotencyKey: 'withdrawal:wd_abc:capture' }),
    );
    expect(withdrawals.markCompleted).toHaveBeenCalledWith('withdrawal-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payments.withdrawal_completed' }),
    );
  });

  it('releases the hold and marks failed when the provider reports failure', async () => {
    const { service, withdrawals, wallet } = buildService();
    await service.applyWithdrawalVerification('withdrawal-1', { status: 'failed' });

    expect(wallet.releaseHold).toHaveBeenCalledWith(
      'hold-1',
      expect.objectContaining({ idempotencyKey: 'withdrawal:wd_abc:release' }),
    );
    expect(withdrawals.markFailed).toHaveBeenCalledWith('withdrawal-1', 'Transfer failed at provider');
  });
});

describe('PaymentsService.failWithdrawalAndReleaseHold', () => {
  it('is idempotent once the withdrawal already reached a terminal state', async () => {
    const { service, wallet, withdrawals } = buildService({
      withdrawals: { findById: vi.fn().mockResolvedValue(buildWithdrawal({ status: 'completed' })) },
    });
    await service.failWithdrawalAndReleaseHold('withdrawal-1', 'exhausted retries');
    expect(wallet.releaseHold).not.toHaveBeenCalled();
    expect(withdrawals.markFailed).not.toHaveBeenCalled();
  });
});
