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
  | 'reconcile-withdrawal';

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

export type PaymentsJobPayload =
  | InitiateDepositJob
  | ReconcileDepositJob
  | InitiateWithdrawalJob
  | ReconcileWithdrawalJob;

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
        default:
          throw new Error(`Unknown payments job: ${job.name}`);
      }
    },
    { connection },
  );
}
