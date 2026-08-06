import type { ObjectId } from 'mongodb';

export interface ConversationParticipant {
  accountId: ObjectId;
  unreadCount: number;
}

export interface ConversationDocument {
  _id: ObjectId;
  participants: ConversationParticipant[];
  // Sorted, colon-joined pair of participant account ids — enforces one conversation per pair
  // via a unique index without needing a multi-key index over the participants array.
  participantsKey: string;
  lastMessageAt: Date;
  lastMessagePreview: string;
  createdAt: Date;
}

export const conversationIndexes = [
  { key: { participantsKey: 1 }, name: 'participantsKey_unique', unique: true },
  {
    key: { 'participants.accountId': 1, lastMessageAt: -1 },
    name: 'participant_lastMessageAt',
    unique: false,
  },
] as const;

export function buildParticipantsKey(accountIdA: string, accountIdB: string): string {
  return [accountIdA, accountIdB].sort().join(':');
}
