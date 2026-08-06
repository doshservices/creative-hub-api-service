import { BadRequestError, NotFoundError, UnauthorizedError } from '../../common/errors.js';
import type { KycVerificationDTO } from './dto.js';
import type { DocumentType } from './model.js';

export interface SubmitVerificationInput {
  documentKey: string;
  documentType: DocumentType;
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

export interface WebhookSignatureVerifierPort {
  verify(rawBody: Buffer, signature: string | undefined): boolean;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
}

interface WebhookPayload {
  reference: string;
  status: 'approved' | 'rejected';
  providerReference?: string;
  reason?: string;
}

function isWebhookPayload(value: unknown): value is WebhookPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.reference === 'string' &&
    (candidate.status === 'approved' || candidate.status === 'rejected')
  );
}

export class IdentityService {
  constructor(
    private readonly repository: KycRepositoryPort,
    private readonly queue: QueueEnqueuerPort,
    private readonly signatureVerifier: WebhookSignatureVerifierPort,
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

  // Webhook handlers update internal state (and would enqueue any follow-up, e.g. notifying the
  // user) — never the original business logic, per the third-party-provider skill.
  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    if (!this.signatureVerifier.verify(rawBody, signature)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestError('Malformed webhook payload');
    }
    if (!isWebhookPayload(parsed)) {
      throw new BadRequestError('Malformed webhook payload');
    }

    const existing = await this.repository.findById(parsed.reference);
    if (!existing) {
      // Unknown reference — nothing to update. Acknowledge rather than error so Prembly doesn't
      // retry a webhook that will never resolve to a record on our side.
      return;
    }
    if (existing.status === parsed.status) {
      // Idempotent on the provider's reference id: a redelivered webhook re-applying the same
      // result is a no-op, not a fresh event — don't write a second audit row for it.
      return;
    }

    const updated = await this.repository.applyResult(
      parsed.reference,
      parsed.status,
      parsed.providerReference ?? null,
      parsed.reason ?? null,
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
