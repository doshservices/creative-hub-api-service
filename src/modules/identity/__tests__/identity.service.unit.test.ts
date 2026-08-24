import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../common/errors.js';
import type { KycVerificationDTO } from '../dto.js';
import { IdentityService } from '../service.js';
import type { AuditRecorderPort, KycRepositoryPort, QueueEnqueuerPort } from '../service.js';

function buildVerification(overrides: Partial<KycVerificationDTO> = {}): KycVerificationDTO {
  return {
    id: 'verification-1',
    accountId: 'account-1',
    documentType: 'national_id',
    documentCountry: 'NGA',
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
  const audit: AuditRecorderPort = {
    record: vi.fn().mockResolvedValue(undefined),
    ...overrides.audit,
  };

  const service = new IdentityService(repository, queue, audit);
  return { service, repository, queue, audit };
}

describe('IdentityService.submitVerification', () => {
  it('creates the record and enqueues a job carrying only the verification id', async () => {
    const { service, repository, queue } = buildService({});

    await service.submitVerification('account-1', {
      documentKey: 'kyc-docs/account-1/id.jpg',
      documentType: 'national_id',
      documentCountry: 'NGA',
    });

    expect(repository.upsertSubmission).toHaveBeenCalledWith('account-1', {
      documentKey: 'kyc-docs/account-1/id.jpg',
      documentType: 'national_id',
      documentCountry: 'NGA',
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

describe('IdentityService.applyProviderResult', () => {
  it('applies the result and records an audit entry', async () => {
    const { service, repository, audit } = buildService({});

    await service.applyProviderResult('verification-1', 'approved', 'prembly-ref', null);

    expect(repository.applyResult).toHaveBeenCalledWith(
      'verification-1',
      'approved',
      'prembly-ref',
      null,
    );
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'account-1',
      action: 'identity.kyc_result',
      targetType: 'kyc_verification',
      targetId: 'verification-1',
    });
  });

  it('acknowledges without erroring when the verification id matches no record', async () => {
    const { service, repository, audit } = buildService({
      repository: { findById: vi.fn().mockResolvedValue(null) },
    });

    await service.applyProviderResult('verification-1', 'approved', 'prembly-ref', null);

    expect(repository.applyResult).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('is idempotent: does not reapply or re-audit an already-applied result', async () => {
    const { service, repository, audit } = buildService({
      repository: {
        findById: vi.fn().mockResolvedValue(buildVerification({ status: 'approved' })),
      },
    });

    await service.applyProviderResult('verification-1', 'approved', 'prembly-ref', null);

    expect(repository.applyResult).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
