import { NotFoundError } from '../../common/errors.js';
import type { KycVerificationDTO, KycVerificationPage } from './dto.js';
import type { DocumentType, KycStatus } from './model.js';

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
  list(params: { status?: KycStatus; limit: number; cursor?: string }): Promise<KycVerificationPage>;
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
    metadata?: Record<string, unknown>;
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

  // Admin review queue — a manual override that exists alongside the Prembly webhook path
  // above, not a replacement for it.
  async listVerifications(params: {
    status?: KycStatus;
    limit: number;
    cursor?: string;
  }): Promise<KycVerificationPage> {
    return this.repository.list(params);
  }

  // actorId here is the reviewing admin, not the verification's own accountId — unlike
  // applyProviderResult's audit above, which is a system-triggered action attributed to the
  // account it's about.
  async approveVerification(actorId: string, verificationId: string): Promise<KycVerificationDTO> {
    const existing = await this.repository.findById(verificationId);
    if (!existing) {
      throw new NotFoundError('Verification not found');
    }
    if (existing.status === 'approved') {
      return existing;
    }

    const updated = await this.repository.applyResult(verificationId, 'approved', null, null);
    if (!updated) {
      throw new NotFoundError('Verification not found');
    }

    await this.audit.record({
      actorId,
      action: 'identity.kyc_approved',
      targetType: 'kyc_verification',
      targetId: updated.id,
      metadata: { accountId: updated.accountId },
    });
    return updated;
  }

  async rejectVerification(
    actorId: string,
    verificationId: string,
    reason: string | null,
  ): Promise<KycVerificationDTO> {
    const existing = await this.repository.findById(verificationId);
    if (!existing) {
      throw new NotFoundError('Verification not found');
    }
    if (existing.status === 'rejected') {
      return existing;
    }

    const updated = await this.repository.applyResult(verificationId, 'rejected', null, reason);
    if (!updated) {
      throw new NotFoundError('Verification not found');
    }

    await this.audit.record({
      actorId,
      action: 'identity.kyc_rejected',
      targetType: 'kyc_verification',
      targetId: updated.id,
      metadata: { accountId: updated.accountId, reason },
    });
    return updated;
  }
}
