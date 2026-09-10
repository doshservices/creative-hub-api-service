import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type {
  FlutterwaveClientPort,
  InitiatePaymentResult,
  InitiateTransferResult,
  VerifyTransactionResult,
  VerifyTransferResult,
} from './provider.js';

export const PAYMENTS_QUEUE_NAME = 'payments.jobs';

export type PaymentsJobName =
  | 'initiate-deposit'
  | 'reconcile-deposit'
  | 'initiate-withdrawal'
  | 'reconcile-withdrawal'
  | 'reconcile-sweep';

export interface InitiateDepositJob {
  depositId: string;
}
export interface ReconcileDepositJob {
  depositId: string;
  providerTransactionId: string;
}
export interface InitiateWithdrawalJob {
  withdrawalId: string;
}
export interface ReconcileWithdrawalJob {
  withdrawalId: string;
  providerTransferId: string;
}
// Empty payload — the sweep takes no per-job input, it queries for whatever is stale at run time.
export type ReconcileSweepJob = Record<string, never>;

export type PaymentsJobPayload =
  | InitiateDepositJob
  | ReconcileDepositJob
  | InitiateWithdrawalJob
  | ReconcileWithdrawalJob
  | ReconcileSweepJob;

// The reconciliation sweep re-checks records already stuck in a non-terminal state; it re-uses
// the queue's existing reconcile-deposit/reconcile-withdrawal job handlers rather than
// duplicating verification/apply logic (see processReconcileSweep below).
export const RECONCILE_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
// A normal webhook arrives within seconds to a couple of minutes; 10 minutes gives ample margin
// before a still-in-flight webhook gets swept as "possibly missed", while still catching a lost
// webhook well within the hour.
export const RECONCILE_STALE_THRESHOLD_MS = 10 * 60 * 1000;

export interface AccountReaderPort {
  findById(id: string): Promise<{ email: string } | null>;
}

// The worker calls Flutterwave and hands the definitive result to the service to apply — see
// service.ts's apply* methods and identity/queue.ts's analogous resultApplier split.
export interface PaymentsResultApplierPort {
  applyDepositInitiation(depositId: string, result: InitiatePaymentResult): Promise<void>;
  applyDepositVerification(
    depositId: string,
    providerTransactionId: string,
    result: VerifyTransactionResult,
  ): Promise<void>;
  applyWithdrawalInitiation(withdrawalId: string, result: InitiateTransferResult): Promise<void>;
  applyWithdrawalVerification(withdrawalId: string, result: VerifyTransferResult): Promise<void>;
}

export interface DepositProcessingRepositoryPort {
  findById(id: string): Promise<{
    accountId: string;
    amountMinor: number;
    currency: string;
    txRef: string;
    status: string;
  } | null>;
  // Reconciliation sweep only — see processReconcileSweep and
  // DepositRepository.findStaleAwaitingPayment for what qualifies as stale.
  findStaleAwaitingPayment(
    olderThan: Date,
  ): Promise<Array<{ id: string; providerTransactionId: string }>>;
}

export interface WithdrawalProcessingRepositoryPort {
  findForProcessing(id: string): Promise<{
    accountId: string;
    amountMinor: number;
    currency: string;
    reference: string;
    bankCode: string;
    accountNumber: string;
    holdEntryId: string;
    status: string;
  } | null>;
  // Reconciliation sweep only — see processReconcileSweep and
  // WithdrawalRepository.findStaleProcessing for what qualifies as stale.
  findStaleProcessing(olderThan: Date): Promise<Array<{ id: string; providerTransferId: string }>>;
}

// The sweep dispatches into the SAME reconcile-deposit/reconcile-withdrawal job handlers the
// webhook path uses (see processReconcileDeposit/processReconcileWithdrawal below) rather than
// re-implementing verification — this is just PaymentsQueuePort's reconcile methods, reused here
// so the worker doesn't need a second Queue/Redis connection to enqueue follow-up jobs.
export interface ReconcileDispatchPort {
  enqueueReconcileDeposit(depositId: string, providerTransactionId: string): Promise<void>;
  enqueueReconcileWithdrawal(withdrawalId: string, providerTransferId: string): Promise<void>;
}

export function createPaymentsQueue(
  connection: ConnectionOptions,
  jobOptions: { attempts: number; backoffMs: number },
): Queue<PaymentsJobPayload> {
  return new Queue<PaymentsJobPayload>(PAYMENTS_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: jobOptions.attempts,
      backoff: { type: 'exponential', delay: jobOptions.backoffMs },
      removeOnComplete: true,
      // Failed jobs stay inspectable in Redis rather than vanishing — see the
      // third-party-provider skill on landing exhausted jobs somewhere visible.
      removeOnFail: false,
    },
  });
}

export interface PaymentsWorkerDeps {
  deposits: DepositProcessingRepositoryPort;
  withdrawals: WithdrawalProcessingRepositoryPort;
  accounts: AccountReaderPort;
  flutterwave: FlutterwaveClientPort;
  service: PaymentsResultApplierPort;
  reconcile: ReconcileDispatchPort;
  depositRedirectUrl: string;
}

async function processInitiateDeposit(
  data: InitiateDepositJob,
  deps: PaymentsWorkerDeps,
): Promise<void> {
  const deposit = await deps.deposits.findById(data.depositId);
  if (!deposit || deposit.status !== 'pending') {
    return;
  }
  const account = await deps.accounts.findById(deposit.accountId);
  if (!account) {
    await deps.service.applyDepositInitiation(data.depositId, {
      status: 'rejected',
      reason: 'Account no longer exists',
    });
    return;
  }

  const result = await deps.flutterwave.initiatePayment({
    txRef: deposit.txRef,
    amountMinor: deposit.amountMinor,
    currency: deposit.currency,
    customerEmail: account.email,
    redirectUrl: deps.depositRedirectUrl,
  });
  await deps.service.applyDepositInitiation(data.depositId, result);
}

async function processReconcileDeposit(
  data: ReconcileDepositJob,
  deps: PaymentsWorkerDeps,
): Promise<void> {
  const deposit = await deps.deposits.findById(data.depositId);
  if (!deposit || deposit.status === 'completed' || deposit.status === 'failed') {
    return;
  }

  const result = await deps.flutterwave.verifyTransaction(data.providerTransactionId);
  if (result.status === 'pending') {
    // Not final yet — throw so BullMQ retries with backoff, same as an HTTP-level failure.
    throw new Error(`Flutterwave transaction ${data.providerTransactionId} still pending`);
  }
  await deps.service.applyDepositVerification(data.depositId, data.providerTransactionId, result);
}

async function processInitiateWithdrawal(
  data: InitiateWithdrawalJob,
  deps: PaymentsWorkerDeps,
): Promise<void> {
  const withdrawal = await deps.withdrawals.findForProcessing(data.withdrawalId);
  if (!withdrawal || withdrawal.status !== 'pending') {
    return;
  }

  const result = await deps.flutterwave.initiateTransfer({
    reference: withdrawal.reference,
    amountMinor: withdrawal.amountMinor,
    currency: withdrawal.currency,
    bankCode: withdrawal.bankCode,
    accountNumber: withdrawal.accountNumber,
    narration: 'Creative Hub payout',
  });
  await deps.service.applyWithdrawalInitiation(data.withdrawalId, result);
}

async function processReconcileWithdrawal(
  data: ReconcileWithdrawalJob,
  deps: PaymentsWorkerDeps,
): Promise<void> {
  const withdrawal = await deps.withdrawals.findForProcessing(data.withdrawalId);
  if (!withdrawal || withdrawal.status === 'completed' || withdrawal.status === 'failed') {
    return;
  }

  const result = await deps.flutterwave.verifyTransfer(data.providerTransferId);
  if (result.status === 'pending') {
    throw new Error(`Flutterwave transfer ${data.providerTransferId} still pending`);
  }
  await deps.service.applyWithdrawalVerification(data.withdrawalId, result);
}

// Reconciliation safety net (money-and-ledger skill's "reconciliation is a first-class scheduled
// job" rule). Scope, deliberately narrow:
//  - DOES: re-verify deposits stuck in 'awaiting_payment' and withdrawals stuck in 'processing'
//    that already have a stored provider id, in case the webhook that would normally resolve
//    them was never delivered (or was delivered but its reconcile-* job exhausted retries).
//    Reuses the exact same processReconcileDeposit/processReconcileWithdrawal handlers the
//    webhook path uses — no new verification/apply logic, no new Flutterwave API call.
//  - DOES NOT: fix a deposit/withdrawal that never obtained a provider id in the first place
//    (initiation itself failed, or the initiate-* job never ran) — those never had a provider-side
//    outcome to re-verify against and are a separate, unrelated failure mode. It also isn't a full
//    ledger-vs-provider-statement diff; it's a targeted safety net for this one failure shape.
// Registered as a repeatable job in index.ts via queue.upsertJobScheduler.
export async function processReconcileSweep(
  _data: ReconcileSweepJob,
  deps: PaymentsWorkerDeps,
): Promise<void> {
  const cutoff = new Date(Date.now() - RECONCILE_STALE_THRESHOLD_MS);

  const staleDeposits = await deps.deposits.findStaleAwaitingPayment(cutoff);
  for (const deposit of staleDeposits) {
    await deps.reconcile.enqueueReconcileDeposit(deposit.id, deposit.providerTransactionId);
  }

  const staleWithdrawals = await deps.withdrawals.findStaleProcessing(cutoff);
  for (const withdrawal of staleWithdrawals) {
    await deps.reconcile.enqueueReconcileWithdrawal(withdrawal.id, withdrawal.providerTransferId);
  }
}

// One queue/worker pair for every payments job kind, dispatched by job name — simpler wiring
// than four separate queues while keeping each job's logic in its own function.
export function createPaymentsWorker(
  connection: ConnectionOptions,
  deps: PaymentsWorkerDeps,
): Worker<PaymentsJobPayload> {
  return new Worker<PaymentsJobPayload>(
    PAYMENTS_QUEUE_NAME,
    async (job: Job<PaymentsJobPayload>) => {
      switch (job.name as PaymentsJobName) {
        case 'initiate-deposit':
          return processInitiateDeposit(job.data as InitiateDepositJob, deps);
        case 'reconcile-deposit':
          return processReconcileDeposit(job.data as ReconcileDepositJob, deps);
        case 'initiate-withdrawal':
          return processInitiateWithdrawal(job.data as InitiateWithdrawalJob, deps);
        case 'reconcile-withdrawal':
          return processReconcileWithdrawal(job.data as ReconcileWithdrawalJob, deps);
        case 'reconcile-sweep':
          return processReconcileSweep(job.data as ReconcileSweepJob, deps);
        default:
          throw new Error(`Unknown payments job: ${job.name}`);
      }
    },
    { connection },
  );
}
