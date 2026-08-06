import type { Collection, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesIndexes,
  type NotificationPreferencesDocument,
} from './model.js';
import type { NotificationPreferencesDTO } from './dto.js';

const PREFERENCES_PROJECTION = {
  emailJobOpportunities: 1,
  emailPaymentNotifications: 1,
  emailMessages: 1,
  smsUrgentJobAlerts: 1,
  smsPaymentConfirmations: 1,
  inAppAllNotifications: 1,
} as const;

function toDTO(doc: NotificationPreferencesDocument): NotificationPreferencesDTO {
  return {
    emailJobOpportunities: doc.emailJobOpportunities,
    emailPaymentNotifications: doc.emailPaymentNotifications,
    emailMessages: doc.emailMessages,
    smsUrgentJobAlerts: doc.smsUrgentJobAlerts,
    smsPaymentConfirmations: doc.smsPaymentConfirmations,
    inAppAllNotifications: doc.inAppAllNotifications,
  };
}

export class NotificationPreferencesRepository {
  private readonly collection: Collection<NotificationPreferencesDocument>;

  constructor(db: Db) {
    this.collection = db.collection<NotificationPreferencesDocument>('notificationPreferences');
  }

  async createIndexes(): Promise<void> {
    for (const index of notificationPreferencesIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async findByAccountId(accountId: string): Promise<NotificationPreferencesDTO | null> {
    const doc = await this.collection.findOne(
      { accountId: new ObjectId(accountId) },
      { projection: PREFERENCES_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  // Partial update: only the fields present in `update` change. A first-time caller gets a
  // document seeded with defaults, then immediately overlaid with their update — two statements
  // because $set and $setOnInsert can't target the same field path in one update.
  async upsertForAccount(
    accountId: string,
    update: Partial<NotificationPreferencesDTO>,
  ): Promise<NotificationPreferencesDTO> {
    const accountObjectId = new ObjectId(accountId);
    const now = new Date();

    await this.collection.updateOne(
      { accountId: accountObjectId },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          accountId: accountObjectId,
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          createdAt: now,
        },
      },
      { upsert: true },
    );

    const result = await this.collection.findOneAndUpdate(
      { accountId: accountObjectId },
      { $set: { ...update, updatedAt: now } },
      { returnDocument: 'after', projection: PREFERENCES_PROJECTION },
    );
    return toDTO(result!);
  }
}
