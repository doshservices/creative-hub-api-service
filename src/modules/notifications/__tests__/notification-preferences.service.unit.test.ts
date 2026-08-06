import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../model.js';
import { NotificationPreferencesService } from '../service.js';
import type { NotificationPreferencesRepositoryPort } from '../service.js';

function buildService(overrides: Partial<NotificationPreferencesRepositoryPort> = {}) {
  const repository: NotificationPreferencesRepositoryPort = {
    findByAccountId: vi.fn().mockResolvedValue(null),
    upsertForAccount: vi
      .fn()
      .mockResolvedValue({ ...DEFAULT_NOTIFICATION_PREFERENCES, emailMessages: false }),
    ...overrides,
  };
  const service = new NotificationPreferencesService(repository);
  return { service, repository };
}

describe('NotificationPreferencesService.getMyPreferences', () => {
  it('returns defaults without writing when no document exists', async () => {
    const { service, repository } = buildService({});

    const result = await service.getMyPreferences('account-1');

    expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(repository.upsertForAccount).not.toHaveBeenCalled();
  });

  it('returns the stored document when one exists', async () => {
    const stored = { ...DEFAULT_NOTIFICATION_PREFERENCES, smsUrgentJobAlerts: false };
    const { service } = buildService({ findByAccountId: vi.fn().mockResolvedValue(stored) });

    await expect(service.getMyPreferences('account-1')).resolves.toEqual(stored);
  });
});

describe('NotificationPreferencesService.updateMyPreferences', () => {
  it('delegates a partial update to the repository', async () => {
    const { service, repository } = buildService({});

    await service.updateMyPreferences('account-1', { emailMessages: false });

    expect(repository.upsertForAccount).toHaveBeenCalledWith('account-1', {
      emailMessages: false,
    });
  });
});
