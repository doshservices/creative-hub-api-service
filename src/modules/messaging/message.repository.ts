import type { Collection, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { messageIndexes, type MessageDocument } from './message.model.js';
import type { MessageDTO, MessagePage } from './dto.js';

const MESSAGE_PROJECTION = {
  conversationId: 1,
  senderAccountId: 1,
  content: 1,
  createdAt: 1,
} as const;

function toDTO(doc: MessageDocument): MessageDTO {
  return {
    id: doc._id.toHexString(),
    conversationId: doc.conversationId.toHexString(),
    senderAccountId: doc.senderAccountId.toHexString(),
    content: doc.content,
    createdAt: doc.createdAt,
  };
}

export class MessageRepository {
  private readonly collection: Collection<MessageDocument>;

  constructor(db: Db) {
    this.collection = db.collection<MessageDocument>('messages');
  }

  async createIndexes(): Promise<void> {
    for (const index of messageIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async create(input: {
    conversationId: string;
    senderAccountId: string;
    content: string;
  }): Promise<MessageDTO> {
    const doc: MessageDocument = {
      _id: new ObjectId(),
      conversationId: new ObjectId(input.conversationId),
      senderAccountId: new ObjectId(input.senderAccountId),
      content: input.content,
      createdAt: new Date(),
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async listByConversation(
    conversationId: string,
    params: { limit: number; cursor?: string },
  ): Promise<MessagePage> {
    const filter: Record<string, unknown> = { conversationId: new ObjectId(conversationId) };
    if (params.cursor) {
      filter._id = { $lt: new ObjectId(params.cursor) };
    }

    const docs = await this.collection
      .find(filter, { projection: MESSAGE_PROJECTION })
      .sort({ _id: -1 })
      .limit(params.limit + 1)
      .toArray();

    const hasMore = docs.length > params.limit;
    const items = docs.slice(0, params.limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
