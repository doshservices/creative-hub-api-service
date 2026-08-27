import { randomUUID } from 'node:crypto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { DepositDTO, DepositPage, WithdrawalDTO, WithdrawalPage } from './dto.js';
import type { InitiatePaymentResult, InitiateTransferResult, VerifyTransactionResult, VerifyTransferResult } from './provider.js';

export const DEFAULT_CURRENCY = 'NGN';

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface InitiateDepositInput {
  amountMinor: number;
  currency?: string;
}

export interface InitiateWithdrawalInput {
  amountMinor: number;
  currency?: string;
  bankCode: string;
  accountNumber: string;
}

export interface DepositRepositoryPort {
  create(input: {
    accountId: string;
    amountMinor: number;
    currency: string;
    txRef: string;
  }): Promise<DepositDTO>;
  findById(id: string): Promise<DepositDTO | null>;
  findByTxRef(txRef: string): Promise<DepositDTO | null>;
  listForAccount(accountId: string, params: PageParams): Promise<DepositPage>;
  setCheckoutUrl(id: string, checkoutUrl: string): Promise<void>;
  markCompleted(id: string, providerTransactionId: string): Promise<unknown>;
  markFailed(id: string, reason: string): Promise<void>;
}

export interface WithdrawalRepositoryPort {
  create(input: {
    accountId: string;
    amountMinor: number;
    currency: string;
    reference: string;
    bankCode: string;
    accountNumber: string;
    holdEntryId: string;
  }): Promise<WithdrawalDTO>;
  findById(id: string): Promise<WithdrawalDTO | null>;
  findByReference(reference: string): Promise<WithdrawalDTO | null>;
  findHoldEntryId(id: string): Promise<string | null>;
  listForAccount(accountId: string, params: PageParams): Promise<WithdrawalPage>;
  markProcessing(id: string, providerTransferId: string): Promise<void>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}

export interface WalletMovementPort {
  hold(
    accountId: string,
    currency: string,
    amountMinor: number,
    options: { idempotencyKey: string; reference?: string; description?: string },
  ): Promise<{ id: string }>;
  credit(
    accountId: string,
    currency: string,
    amountMinor: number,
    options: { idempotencyKey: string; reference?: string; description?: string },
  ): Promise<unknown>;
  releaseHold(
    holdEntryId: string,
    options: { idempotencyKey: string; reference?: string; description?: string },
  ): Promise<unknown>;
  captureHold(
    holdEntryId: string,
    options: { idempotencyKey: string; reference?: string; description?: string },
  ): Promise<unknown>;
}

export interface PaymentsQueuePort {
  enqueueInitiateDeposit(depositId: string): Promise<void>;
  enqueueReconcileDeposit(depositId: string, providerTransactionId: string): Promise<void>;
  enqueueInitiateWithdrawal(withdrawalId: string): Promise<void>;
  enqueueReconcileWithdrawal(withdrawalId: string, providerTransferId: string): Promise<void>;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
}

function assertPositiveInteger(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new BadRequestError('amountMinor must be a positive integer');
  }
}

export class PaymentsService {
  constructor(
    private readonly deposits: DepositRepositoryPort,
    private readonly withdrawals: WithdrawalRepositoryPort,
    private readonly wallet: WalletMovementPort,
    private readonly queue: PaymentsQueuePort,
    private readonly audit: AuditRecorderPort,
  ) {}

  async initiateDeposit(accountId: string, input: InitiateDepositInput): Promise<DepositDTO> {
    assertPositiveInteger(input.amountMinor);
    const txRef = `dep_${randomUUID()}`;
    const deposit = await this.deposits.create({
      accountId,
      amountMinor: input.amountMinor,
      currency: input.currency ?? DEFAULT_CURRENCY,
      txRef,
    });
    await this.queue.enqueueInitiateDeposit(deposit.id);
    return deposit;
  }

  async getMyDeposit(accountId: string, depositId: string): Promise<DepositDTO> {
    const deposit = await this.deposits.findById(depositId);
    if (!deposit) {
      throw new NotFoundError('Deposit not found');
    }
    if (deposit.accountId !== accountId) {
      throw new ForbiddenError('You do not own this deposit');
    }
    return deposit;
  }

  async listMyDeposits(accountId: string, params: PageParams): Promise<DepositPage> {
    return this.deposits.listForAccount(accountId, params);
  }

  // Wallet funds are placed on hold *before* the withdrawal record exists — if the hold fails
  // (insufficient available balance), nothing is created and the caller sees that error.
  async initiateWithdrawal(
    accountId: string,
    input: InitiateWithdrawalInput,
  ): Promise<WithdrawalDTO> {
    assertPositiveInteger(input.amountMinor);
    const currency = input.currency ?? DEFAULT_CURRENCY;
    const reference = `wd_${randomUUID()}`;

    const hold = await this.wallet.hold(accountId, currency, input.amountMinor, {
      idempotencyKey: `withdrawal:${reference}:hold`,
      reference,
      description: 'Withdrawal request pending provider payout',
    });

    const withdrawal = await this.withdrawals.create({
      accountId,
      amountMinor: input.amountMinor,
      currency,
      reference,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      holdEntryId: hold.id,
    });
    await this.queue.enqueueInitiateWithdrawal(withdrawal.id);
    return withdrawal;
  }

  async getMyWithdrawal(accountId: string, withdrawalId: string): Promise<WithdrawalDTO> {
    const withdrawal = await this.withdrawals.findById(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundError('Withdrawal not found');
    }
    if (withdrawal.accountId !== accountId) {
      throw new ForbiddenError('You do not own this withdrawal');
    }
    return withdrawal;
  }

  async listMyWithdrawals(accountId: string, params: PageParams): Promise<WithdrawalPage> {
    return this.withdrawals.listForAccount(accountId, params);
  }

  // Called from the webhook route after signature verification — its only job is to resolve
  // the provider's reference to our internal record and enqueue reconciliation; the actual
  // provider re-verification and business logic run in the worker (via the apply* methods
  // below), never inline here. See the third-party-provider skill.
  async handleChargeCompleted(txRef: string, providerTransactionId: string): Promise<void> {
    const deposit = await this.deposits.findByTxRef(txRef);
    if (!deposit) {
      return;
    }
    await this.queue.enqueueReconcileDeposit(deposit.id, providerTransactionId);
  }

  async handleTransferCompleted(reference: string, providerTransferId: string): Promise<void> {
    const withdrawal = await this.withdrawals.findByReference(reference);
    if (!withdrawal) {
      return;
    }
    await this.queue.enqueueReconcileWithdrawal(withdrawal.id, providerTransferId);
  }

  // Everything below is called only from the payments worker (queue.ts), which does the actual
  // Flutterwave call and hands the definitive result here — mirrors identity's
  // worker-calls-provider / service-applies-result split (see IdentityService.applyProviderResult).

  async applyDepositInitiation(depositId: string, result: InitiatePaymentResult): Promise<void> {
    if (result.status === 'rejected') {
      await this.deposits.markFailed(depositId, result.reason);
      return;
    }
    await this.deposits.setCheckoutUrl(depositId, result.checkoutUrl);
  }

  async applyDepositVerification(
    depositId: string,
    providerTransactionId: string,
    result: VerifyTransactionResult,
  ): Promise<void> {
    const deposit = await this.deposits.findById(depositId);
    if (!deposit || deposit.status === 'completed' || deposit.status === 'failed') {
      // Resubmitted/already-resolved since the job was queued — nothing to do, and retrying
      // won't change that.
      return;
    }

    if (result.status === 'failed') {
      await this.deposits.markFailed(depositId, 'Payment failed at provider');
      return;
    }
    if (result.amountMinor !== deposit.amountMinor || result.currency !== deposit.currency) {
      // Never credit an amount the provider didn't actually confirm — surfaced as failed rather
      // than silently crediting the wrong figure.
      await this.deposits.markFailed(
        depositId,
        `Verified amount ${result.amountMinor} ${result.currency} did not match expected ${deposit.amountMinor} ${deposit.currency}`,
      );
      return;
    }

    await this.wallet.credit(deposit.accountId, deposit.currency, deposit.amountMinor, {
      idempotencyKey: `deposit:${depositId}`,
      reference: deposit.txRef,
      description: 'Wallet deposit via Flutterwave',
    });
    await this.deposits.markCompleted(depositId, providerTransactionId);
    await this.audit.record({
      actorId: deposit.accountId,
      action: 'payments.deposit_completed',
      targetType: 'deposit',
      targetId: depositId,
    });
  }

  async applyWithdrawalInitiation(
    withdrawalId: string,
    result: InitiateTransferResult,
  ): Promise<void> {
    if (result.status === 'accepted') {
      await this.withdrawals.markProcessing(withdrawalId, result.providerTransferId);
      return;
    }
    await this.failWithdrawalAndReleaseHold(withdrawalId, result.reason);
  }

  async applyWithdrawalVerification(
    withdrawalId: string,
    result: VerifyTransferResult,
  ): Promise<void> {
    const withdrawal = await this.withdrawals.findById(withdrawalId);
    if (!withdrawal || withdrawal.status === 'completed' || withdrawal.status === 'failed') {
      return;
    }

    if (result.status === 'successful') {
      const holdEntryId = await this.withdrawals.findHoldEntryId(withdrawalId);
      if (holdEntryId) {
        await this.wallet.captureHold(holdEntryId, {
          idempotencyKey: `withdrawal:${withdrawal.reference}:capture`,
          reference: withdrawal.reference,
          description: 'Withdrawal payout via Flutterwave',
        });
      }
      await this.withdrawals.markCompleted(withdrawalId);
      await this.audit.record({
        actorId: withdrawal.accountId,
        action: 'payments.withdrawal_completed',
        targetType: 'withdrawal',
        targetId: withdrawalId,
      });
      return;
    }

    await this.failWithdrawalAndReleaseHold(withdrawalId, 'Transfer failed at provider');
  }

  // Exhausted-retries path (see queue.ts's worker.on('failed') handler) reuses this too, so a
  // withdrawal never stays 'pending'/'processing' with funds stuck on hold indefinitely.
  async failWithdrawalAndReleaseHold(withdrawalId: string, reason: string): Promise<void> {
    const withdrawal = await this.withdrawals.findById(withdrawalId);
    if (!withdrawal || withdrawal.status === 'completed' || withdrawal.status === 'failed') {
      return;
    }
    const holdEntryId = await this.withdrawals.findHoldEntryId(withdrawalId);
    if (holdEntryId) {
      await this.wallet.releaseHold(holdEntryId, {
        idempotencyKey: `withdrawal:${withdrawal.reference}:release`,
        reference: withdrawal.reference,
        description: reason,
      });
    }
    await this.withdrawals.markFailed(withdrawalId, reason);
    await this.audit.record({
      actorId: withdrawal.accountId,
      action: 'payments.withdrawal_failed',
      targetType: 'withdrawal',
      targetId: withdrawalId,
    });
  }

  async failDepositWithReason(depositId: string, reason: string): Promise<void> {
    const deposit = await this.deposits.findById(depositId);
    if (!deposit || deposit.status === 'completed' || deposit.status === 'failed') {
      return;
    }
    await this.deposits.markFailed(depositId, reason);
  }
}
