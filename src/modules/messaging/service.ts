import { BadRequestError, NotFoundError } from '../../common/errors.js';
import type { ConversationDTO, ConversationPage, MessageDTO, MessagePage } from './dto.js';

export interface PageParams {
  limit: number;
  cursor?: string;
}

// Minimal read surface messaging needs from auth — see auth/index.ts, the only import path
// other modules may use to reach that module.
export interface AccountReaderPort {
  findById(id: string): Promise<{ id: string } | null>;
}

export interface ConversationRepositoryPort {
  findOrCreate(accountIdA: string, accountIdB: string): Promise<string>;
  recordMessage(conversationId: string, recipientAccountId: string, preview: string): Promise<void>;
  markRead(conversationId: string, accountId: string): Promise<void>;
  findByIdForAccount(conversationId: string, accountId: string): Promise<ConversationDTO | null>;
  listForAccount(accountId: string, params: PageParams): Promise<ConversationPage>;
}

export interface MessageRepositoryPort {
  create(input: {
    conversationId: string;
    senderAccountId: string;
    content: string;
  }): Promise<MessageDTO>;
  listByConversation(conversationId: string, params: PageParams): Promise<MessagePage>;
}

const PREVIEW_LENGTH = 140;

function buildPreview(content: string): string {
  return content.length > PREVIEW_LENGTH ? `${content.slice(0, PREVIEW_LENGTH)}…` : content;
}

export class MessagingService {
  constructor(
    private readonly conversations: ConversationRepositoryPort,
    private readonly messages: MessageRepositoryPort,
    private readonly accounts: AccountReaderPort,
  ) {}

  async sendMessage(
    senderAccountId: string,
    recipientAccountId: string,
    content: string,
  ): Promise<MessageDTO> {
    if (senderAccountId === recipientAccountId) {
      throw new BadRequestError('You cannot message yourself');
    }
    const recipient = await this.accounts.findById(recipientAccountId);
    if (!recipient) {
      throw new NotFoundError('Recipient account not found');
    }

    const conversationId = await this.conversations.findOrCreate(
      senderAccountId,
      recipientAccountId,
    );
    const message = await this.messages.create({ conversationId, senderAccountId, content });
    await this.conversations.recordMessage(
      conversationId,
      recipientAccountId,
      buildPreview(content),
    );
    return message;
  }

  async listMyConversations(accountId: string, params: PageParams): Promise<ConversationPage> {
    return this.conversations.listForAccount(accountId, params);
  }

  async listMessages(
    accountId: string,
    conversationId: string,
    params: PageParams,
  ): Promise<MessagePage> {
    const conversation = await this.conversations.findByIdForAccount(conversationId, accountId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }
    return this.messages.listByConversation(conversationId, params);
  }

  async markRead(accountId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversations.findByIdForAccount(conversationId, accountId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }
    await this.conversations.markRead(conversationId, accountId);
  }
}
