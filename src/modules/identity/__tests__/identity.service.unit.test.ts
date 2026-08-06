import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../../common/errors.js';
import type { KycVerificationDTO } from '../dto.js';
import { HmacWebhookSignatureVerifier } from '../provider.js';
import { IdentityService } from '../service.js';
import type {
  AuditRecorderPort,
  KycRepositoryPort,
  QueueEnqueuerPort,
  WebhookSignatureVerifierPort,
} from '../service.js';

function buildVerification(overrides: Partial<KycVerificationDTO> = {}): KycVerificationDTO {
  return {
    id: 'verification-1',
    accountId: 'account-1',
    documentType: 'national_id',
    status: 'pending',
    providerReference: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  repository?: Partial<KycRepositoryPort>;
  queue?: Partial<QueueEnqueuerPort>;
  signatureVerifier?: WebhookSignatureVerifierPort;
  audit?: Partial<AuditRecorderPort>;
}) {
  const repository: KycRepositoryPort = {
    upsertSubmission: vi.fn().mockResolvedValue(buildVerification()),
    findByAccountId: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(buildVerification({ status: 'pending' })),
    applyResult: vi.fn().mockResolvedValue(buildVerification({ status: 'approved' })),
    ...overrides.repository,
  };
  const queue: QueueEnqueuerPort = {
    enqueueVerification: vi.fn().mockResolvedValue(undefined),
    ...overrides.queue,
  };
  const signatureVerifier: WebhookSignatureVerifierPort = overrides.signatureVerifier ?? {
    verify: vi.fn().mockReturnValue(true),
  };
  const audit: AuditRecorderPort = {
    record: vi.fn().mockResolvedValue(undefined),
    ...overrides.audit,
  };

  const service = new IdentityService(repository, queue, signatureVerifier, audit);
  return { service, repository, queue, signatureVerifier, audit };
}

describe('IdentityService.submitVerification', () => {
  it('creates the record and enqueues a job carrying only the verification id', async () => {
    const { service, repository, queue } = buildService({});

    await service.submitVerification('account-1', {
      documentKey: 'kyc-docs/account-1/id.jpg',
      documentType: 'national_id',
    });

    expect(repository.upsertSubmission).toHaveBeenCalledWith('account-1', {
      documentKey: 'kyc-docs/account-1/id.jpg',
      documentType: 'national_id',
    });
    expect(queue.enqueueVerification).toHaveBeenCalledWith('verification-1');
  });
});

describe('IdentityService.getMyVerification', () => {
  it('throws NotFoundError when no verification exists', async () => {
    const { service } = buildService({});

    await expect(service.getMyVerification('account-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns the stored verification', async () => {
    const { service } = buildService({
      repository: { findByAccountId: vi.fn().mockResolvedValue(buildVerification()) },
    });

    await expect(service.getMyVerification('account-1')).resolves.toMatchObject({
      id: 'verification-1',
    });
  });
});

describe('IdentityService.handleWebhook', () => {
  const payload = Buffer.from(JSON.stringify({ reference: 'verification-1', status: 'approved' }));

  it('rejects an invalid signature before parsing anything', async () => {
    const { service, repository } = buildService({
      signatureVerifier: { verify: vi.fn().mockReturnValue(false) },
    });

    await expect(service.handleWebhook(payload, 'bad-signature')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(repository.applyResult).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload', async () => {
    const { service } = buildService({});

    await expect(service.handleWebhook(Buffer.from('not json'), 'sig')).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('rejects a payload missing required fields', async () => {
    const { service } = buildService({});

    await expect(
      service.handleWebhook(Buffer.from(JSON.stringify({ status: 'approved' })), 'sig'),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('applies the result and records an audit entry on a valid signature', async () => {
    const { service, repository, audit } = buildService({});

    await service.handleWebhook(payload, 'sig');

    expect(repository.applyResult).toHaveBeenCalledWith('verification-1', 'approved', null, null);
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'account-1',
      action: 'identity.kyc_result',
      targetType: 'kyc_verification',
      targetId: 'verification-1',
    });
  });

  it('acknowledges without erroring when the reference matches no record', async () => {
    const { service, repository, audit } = buildService({
      repository: { findById: vi.fn().mockResolvedValue(null) },
    });

    await service.handleWebhook(payload, 'sig');

    expect(repository.applyResult).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('is idempotent on redelivery: does not reapply or re-audit an already-applied result', async () => {
    const { service, repository, audit } = buildService({
      repository: {
        findById: vi.fn().mockResolvedValue(buildVerification({ status: 'approved' })),
      },
    });

    await service.handleWebhook(payload, 'sig');

    expect(repository.applyResult).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('HmacWebhookSignatureVerifier', () => {
  const secret = 'test-secret';
  const verifier = new HmacWebhookSignatureVerifier(secret);
  const body = Buffer.from(JSON.stringify({ reference: 'v1', status: 'approved' }));

  it('accepts a correctly signed body', () => {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifier.verify(body, signature)).toBe(true);
  });

  it('rejects a body signed with the wrong secret', () => {
    const signature = createHmac('sha256', 'wrong-secret').update(body).digest('hex');
    expect(verifier.verify(body, signature)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifier.verify(body, undefined)).toBe(false);
  });
});
