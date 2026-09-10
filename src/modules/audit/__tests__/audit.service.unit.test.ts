import { describe, expect, it, vi } from 'vitest';
import type { AuditEntryDTO, AuditEntryPage } from '../dto.js';
import type { AuditWriterPort } from '../service.js';
import { AuditService } from '../service.js';

function buildEntry(overrides: Partial<AuditEntryDTO> = {}): AuditEntryDTO {
  return {
    id: 'entry-1',
    actorId: 'account-1',
    action: 'auth.login',
    targetType: 'account',
    targetId: 'account-1',
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: Partial<AuditWriterPort> = {}) {
  const repository: AuditWriterPort = {
    create: vi.fn().mockResolvedValue(buildEntry()),
    list: vi.fn().mockResolvedValue({ items: [buildEntry()], nextCursor: null }),
    ...overrides,
  };
  const service = new AuditService(repository);
  return { service, repository };
}

describe('AuditService.record', () => {
  it('delegates to the repository', async () => {
    const { service, repository } = buildService();

    await service.record({
      actorId: 'account-1',
      action: 'auth.login',
      targetType: 'account',
      targetId: 'account-1',
    });

    expect(repository.create).toHaveBeenCalledWith({
      actorId: 'account-1',
      action: 'auth.login',
      targetType: 'account',
      targetId: 'account-1',
    });
  });
});

describe('AuditService.list', () => {
  it('delegates straight to the repository (read-only, no ownership check)', async () => {
    const { service, repository } = buildService();

    const result = await service.list({ limit: 20, action: 'auth.login' });

    expect(repository.list).toHaveBeenCalledWith({ limit: 20, action: 'auth.login' });
    expect(result.items).toHaveLength(1);
  });

  it('returns nextCursor as given by the repository for pagination', async () => {
    const page: AuditEntryPage = { items: [buildEntry()], nextCursor: 'entry-1' };
    const { service } = buildService({ list: vi.fn().mockResolvedValue(page) });

    const result = await service.list({ limit: 1 });

    expect(result.nextCursor).toBe('entry-1');
  });
});
