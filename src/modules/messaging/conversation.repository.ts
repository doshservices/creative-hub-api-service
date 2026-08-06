import type { Collection, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  buildParticipantsKey,
  conversationIndexes,
  type ConversationDocument,
} from './conversation.model.js';
import type { ConversationDTO, ConversationPage } from './dto.js';

const CONVERSATION_PROJECTION = {
  participants: 1,
  participantsKey: 1,
  lastMessageAt: 1,
  lastMessagePreview: 1,
  createdAt: 1,
} as const;

interface Cursor {
  t: string;
  id: string;
}

// Conversations are paginated by "most recently active" (lastMessageAt), not creation order, so
// unlike every other list in this codebase the cursor can't just be the last _id — lastMessageAt
// isn't unique across conversations, so the cursor carries both fields as the tiebreaker.
function encodeCursor(lastMessageAt: Date, id: string): string {
  const payload: Cursor = { t: lastMessageAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): Cursor {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Cursor;
}

function toDTO(doc: ConversationDocument, accountId: string): ConversationDTO {
  const me = doc.participants.find((p) => p.accountId.toHexString() === accountId);
  const other = doc.participants.find((p) => p.accountId.toHexString() !== accountId);
  return {
    id: doc._id.toHexString(),
    otherAccountId: other ? other.accountId.toHexString() : '',
    lastMessageAt: doc.lastMessageAt,
    lastMessagePreview: doc.lastMessagePreview,
    unreadCount: me?.unreadCount ?? 0,
  };
}

export class ConversationRepository {
  private readonly collection: Collection<ConversationDocument>;

  constructor(db: Db) {
    this.collection = db.collection<ConversationDocument>('conversations');
  }

  async createIndexes(): Promise<void> {
    for (const index of conversationIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async findOrCreate(accountIdA: string, accountIdB: string): Promise<string> {
    const participantsKey = buildParticipantsKey(accountIdA, accountIdB);
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { participantsKey },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          participantsKey,
          participants: [
            { accountId: new ObjectId(accountIdA), unreadCount: 0 },
            { accountId: new ObjectId(accountIdB), unreadCount: 0 },
          ],
          lastMessageAt: now,
          lastMessagePreview: '',
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after', projection: { _id: 1 } },
    );
    return result!._id.toHexString();
  }

  async recordMessage(
    conversationId: string,
    recipientAccountId: string,
    preview: string,
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: { lastMessageAt: new Date(), lastMessagePreview: preview },
        $inc: { 'participants.$[recipient].unreadCount': 1 },
      },
      { arrayFilters: [{ 'recipient.accountId': new ObjectId(recipientAccountId) }] },
    );
  }

  async markRead(conversationId: string, accountId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(conversationId) },
      { $set: { 'participants.$[me].unreadCount': 0 } },
      { arrayFilters: [{ 'me.accountId': new ObjectId(accountId) }] },
    );
  }

  async findByIdForAccount(
    conversationId: string,
    accountId: string,
  ): Promise<ConversationDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(conversationId), 'participants.accountId': new ObjectId(accountId) },
      { projection: CONVERSATION_PROJECTION },
    );
    return doc ? toDTO(doc, accountId) : null;
  }

  async listForAccount(
    accountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ConversationPage> {
    const filter: Record<string, unknown> = {
      'participants.accountId': new ObjectId(accountId),
    };
    if (params.cursor) {
      const { t, id } = decodeCursor(params.cursor);
      const cursorDate = new Date(t);
      filter.$or = [
        { lastMessageAt: { $lt: cursorDate } },
        { lastMessageAt: cursorDate, _id: { $lt: new ObjectId(id) } },
      ];
    }

    const docs = await this.collection
      .find(filter, { projection: CONVERSATION_PROJECTION })
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(params.limit + 1)
      .toArray();

    const hasMore = docs.length > params.limit;
    const page = docs.slice(0, params.limit);
    const items = page.map((doc) => toDTO(doc, accountId));
    const lastDoc = page[page.length - 1];
    const nextCursor =
      hasMore && lastDoc ? encodeCursor(lastDoc.lastMessageAt, lastDoc._id.toHexString()) : null;
    return { items, nextCursor };
  }
}
