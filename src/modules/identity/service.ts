import { NotFoundError } from '../../common/errors.js';
import type { KycVerificationDTO } from './dto.js';
import type { DocumentType } from './model.js';

export interface SubmitVerificationInput {
  documentKey: string;
  documentType: DocumentType;
  documentCountry: string;
}

export interface KycRepositoryPort {
  upsertSubmission(accountId: string, input: SubmitVerificationInput): Promise<KycVerificationDTO>;
  findByAccountId(accountId: string): Promise<KycVerificationDTO | null>;
  findById(id: string): Promise<KycVerificationDTO | null>;
  applyResult(
    id: string,
    status: 'approved' | 'rejected',
    providerReference: string | null,
    failureReason: string | null,
  ): Promise<KycVerificationDTO | null>;
}

export interface QueueEnqueuerPort {
  enqueueVerification(verificationId: string): Promise<void>;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
}

export class IdentityService {
  constructor(
    private readonly repository: KycRepositoryPort,
    private readonly queue: QueueEnqueuerPort,
    private readonly audit: AuditRecorderPort,
  ) {}

  async submitVerification(
    accountId: string,
    input: SubmitVerificationInput,
  ): Promise<KycVerificationDTO> {
    const verification = await this.repository.upsertSubmission(accountId, input);
    await this.queue.enqueueVerification(verification.id);
    return verification;
  }

  async getMyVerification(accountId: string): Promise<KycVerificationDTO> {
    const verification = await this.repository.findByAccountId(accountId);
    if (!verification) {
      throw new NotFoundError('No KYC verification exists for this account yet');
    }
    return verification;
  }

  // Called by the KYC worker once Prembly's document-verification call returns a definitive
  // verdict (the call is synchronous — see provider.ts — so there's no webhook redelivery to
  // guard against, but the worker's own retry/backoff on a transient failure could still call
  // this twice for the same job, so it stays idempotent on "already at this status".
  async applyProviderResult(
    verificationId: string,
    status: 'approved' | 'rejected',
    providerReference: string | null,
    failureReason: string | null,
  ): Promise<void> {
    const existing = await this.repository.findById(verificationId);
    if (!existing) {
      // Resubmitted/removed since the job was queued — nothing to do.
      return;
    }
    if (existing.status === status) {
      return;
    }

    const updated = await this.repository.applyResult(
      verificationId,
      status,
      providerReference,
      failureReason,
    );
    if (!updated) {
      return;
    }

    await this.audit.record({
      actorId: updated.accountId,
      action: 'identity.kyc_result',
      targetType: 'kyc_verification',
      targetId: updated.id,
    });
  }
}
