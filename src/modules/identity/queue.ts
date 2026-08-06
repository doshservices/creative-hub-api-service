import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';

export const KYC_QUEUE_NAME = 'identity.kyc-verification';

export interface KycJobPayload {
  verificationId: string;
}

export interface DocumentUrlSignerPort {
  createPresignedGetUrl(key: string): Promise<string>;
}

export interface PremblySubmitterPort {
  submitVerification(input: {
    reference: string;
    documentUrl: string;
    documentType: string;
  }): Promise<void>;
}

export interface KycProcessingRepositoryPort {
  findForProcessing(
    id: string,
  ): Promise<{ accountId: string; documentKey: string; documentType: string } | null>;
}

export function createKycQueue(
  connection: ConnectionOptions,
  jobOptions: { attempts: number; backoffMs: number },
): Queue<KycJobPayload> {
  return new Queue<KycJobPayload>(KYC_QUEUE_NAME, {
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

// The worker only resolves a fresh presigned URL and calls Prembly; it never receives the
// document key directly in the job payload (see the third-party-provider skill: a job payload
// carries a reference, not a duplicate copy of data already in Mongo).
export function createKycWorker(
  connection: ConnectionOptions,
  deps: {
    repository: KycProcessingRepositoryPort;
    documentSigner: DocumentUrlSignerPort;
    premblyClient: PremblySubmitterPort;
  },
): Worker<KycJobPayload> {
  return new Worker<KycJobPayload>(
    KYC_QUEUE_NAME,
    async (job: Job<KycJobPayload>) => {
      const record = await deps.repository.findForProcessing(job.data.verificationId);
      if (!record) {
        // The verification was resubmitted/removed after this job was queued — nothing to do,
        // and retrying won't change that, so treat it as a completed no-op rather than failing.
        return;
      }

      const documentUrl = await deps.documentSigner.createPresignedGetUrl(record.documentKey);
      await deps.premblyClient.submitVerification({
        reference: job.data.verificationId,
        documentUrl,
        documentType: record.documentType,
      });
      // Prembly acknowledges submission here; the actual pass/fail verdict arrives later via
      // the webhook. A thrown error above triggers BullMQ's configured retry/backoff.
    },
    { connection },
  );
}
