import type { ObjectId } from 'mongodb';

export interface MessageDocument {
  _id: ObjectId;
  conversationId: ObjectId;
  senderAccountId: ObjectId;
  content: string;
  createdAt: Date;
}

export const messageIndexes = [
  { key: { conversationId: 1, _id: -1 }, name: 'conversationId_id', unique: false },
] as const;
