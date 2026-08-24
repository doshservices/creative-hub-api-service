import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { PremblyVerificationResult } from './provider.js';

export const KYC_QUEUE_NAME = 'identity.kyc-verification';

export interface KycJobPayload {
  verificationId: string;
}

// Prembly's document-verification endpoint takes the image inline (base64), not a URL it fetches
// itself — see provider.ts — so the worker needs the raw bytes, not a presigned link.
export interface DocumentBytesFetcherPort {
  fetchBase64(key: string): Promise<string>;
}

export interface PremblySubmitterPort {
  submitVerification(input: {
    documentImageBase64: string;
    documentType: string;
    documentCountry: string;
  }): Promise<PremblyVerificationResult>;
}

export interface KycResultApplierPort {
  applyProviderResult(
    verificationId: string,
    status: 'approved' | 'rejected',
    providerReference: string | null,
    failureReason: string | null,
  ): Promise<void>;
}

export interface KycProcessingRepositoryPort {
  findForProcessing(id: string): Promise<{
    accountId: string;
    documentKey: string;
    documentType: string;
    documentCountry: string;
  } | null>;
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

// The worker calls Prembly directly and applies whatever verdict comes back in that same call —
// Prembly's document-verification endpoint responds synchronously, so unlike a webhook-driven
// integration there's no separate callback path; a thrown error here (transient HTTP failure, or
// a non-final PENDING status — see provider.ts) triggers BullMQ's configured retry/backoff.
export function createKycWorker(
  connection: ConnectionOptions,
  deps: {
    repository: KycProcessingRepositoryPort;
    documentFetcher: DocumentBytesFetcherPort;
    premblyClient: PremblySubmitterPort;
    resultApplier: KycResultApplierPort;
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

      const documentImageBase64 = await deps.documentFetcher.fetchBase64(record.documentKey);
      const result = await deps.premblyClient.submitVerification({
        documentImageBase64,
        documentType: record.documentType,
        documentCountry: record.documentCountry,
      });

      await deps.resultApplier.applyProviderResult(
        job.data.verificationId,
        result.status,
        result.providerReference,
        result.failureReason,
      );
    },
    { connection },
  );
}
