import { DEFAULT_NOTIFICATION_PREFERENCES } from './model.js';
import type { NotificationPreferencesDTO } from './dto.js';

export interface NotificationPreferencesRepositoryPort {
  findByAccountId(accountId: string): Promise<NotificationPreferencesDTO | null>;
  upsertForAccount(
    accountId: string,
    update: Partial<NotificationPreferencesDTO>,
  ): Promise<NotificationPreferencesDTO>;
}

export class NotificationPreferencesService {
  constructor(private readonly repository: NotificationPreferencesRepositoryPort) {}

  // Reads never write: an account with no stored document just gets the defaults back, rather
  // than a GET silently provisioning a row.
  async getMyPreferences(accountId: string): Promise<NotificationPreferencesDTO> {
    const stored = await this.repository.findByAccountId(accountId);
    return stored ?? { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  async updateMyPreferences(
    accountId: string,
    update: Partial<NotificationPreferencesDTO>,
  ): Promise<NotificationPreferencesDTO> {
    return this.repository.upsertForAccount(accountId, update);
  }
}
