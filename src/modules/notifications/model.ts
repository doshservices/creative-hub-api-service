import type { ObjectId } from 'mongodb';

// The six toggles the frontend's Settings > Notifications tab currently exposes, split by
// channel. Fixed fields rather than a dynamic category map — the set is small and known today,
// and a strict schema documents itself in the Scalar reference; extend when a new toggle lands.
export interface NotificationPreferencesDocument {
  _id: ObjectId;
  accountId: ObjectId;
  emailJobOpportunities: boolean;
  emailPaymentNotifications: boolean;
  emailMessages: boolean;
  smsUrgentJobAlerts: boolean;
  smsPaymentConfirmations: boolean;
  inAppAllNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const notificationPreferencesIndexes = [
  { key: { accountId: 1 }, name: 'accountId_unique', unique: true },
] as const;

// Every toggle defaults on, matching the frontend mock — an account with no stored document
// yet (the common case) reads as "everything enabled" rather than "everything off".
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailJobOpportunities: true,
  emailPaymentNotifications: true,
  emailMessages: true,
  smsUrgentJobAlerts: true,
  smsPaymentConfirmations: true,
  inAppAllNotifications: true,
} as const;
