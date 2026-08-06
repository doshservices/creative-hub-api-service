import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, NotFoundError } from '../../../common/errors.js';
import type { ConversationDTO, MessageDTO } from '../dto.js';
import { MessagingService } from '../service.js';
import type {
  AccountReaderPort,
  ConversationRepositoryPort,
  MessageRepositoryPort,
} from '../service.js';

function buildConversation(overrides: Partial<ConversationDTO> = {}): ConversationDTO {
  return {
    id: 'conversation-1',
    otherAccountId: 'account-2',
    lastMessageAt: new Date(),
    lastMessagePreview: 'hi',
    unreadCount: 0,
    ...overrides,
  };
}

function buildMessage(overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    senderAccountId: 'account-1',
    content: 'hi',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  conversations?: Partial<ConversationRepositoryPort>;
  messages?: Partial<MessageRepositoryPort>;
  accounts?: Partial<AccountReaderPort>;
}) {
  const conversations: ConversationRepositoryPort = {
    findOrCreate: vi.fn().mockResolvedValue('conversation-1'),
    recordMessage: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    findByIdForAccount: vi.fn().mockResolvedValue(buildConversation()),
    listForAccount: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    ...overrides.conversations,
  };
  const messages: MessageRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildMessage()),
    listByConversation: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    ...overrides.messages,
  };
  const accounts: AccountReaderPort = {
    findById: vi.fn().mockResolvedValue({ id: 'account-2' }),
    ...overrides.accounts,
  };

  const service = new MessagingService(conversations, messages, accounts);
  return { service, conversations, messages, accounts };
}

describe('MessagingService.sendMessage', () => {
  it('finds-or-creates the conversation and records the message', async () => {
    const { service, conversations, messages } = buildService({});

    await service.sendMessage('account-1', 'account-2', 'Hello there');

    expect(conversations.findOrCreate).toHaveBeenCalledWith('account-1', 'account-2');
    expect(messages.create).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      senderAccountId: 'account-1',
      content: 'Hello there',
    });
    expect(conversations.recordMessage).toHaveBeenCalledWith(
      'conversation-1',
      'account-2',
      'Hello there',
    );
  });

  it('truncates a long message into the conversation preview', async () => {
    const { service, conversations } = buildService({});
    const longContent = 'x'.repeat(200);

    await service.sendMessage('account-1', 'account-2', longContent);

    const previewArg = (conversations.recordMessage as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[2] as string;
    expect(previewArg.length).toBe(141);
    expect(previewArg.endsWith('…')).toBe(true);
  });

  it('rejects messaging yourself', async () => {
    const { service } = buildService({});

    await expect(service.sendMessage('account-1', 'account-1', 'hi')).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('rejects messaging an account that does not exist', async () => {
    const { service } = buildService({ accounts: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.sendMessage('account-1', 'missing', 'hi')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('MessagingService.listMessages', () => {
  it('rejects a non-participant', async () => {
    const { service } = buildService({
      conversations: { findByIdForAccount: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.listMessages('account-9', 'conversation-1', { limit: 20 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns messages for a participant', async () => {
    const { service, messages } = buildService({});

    await service.listMessages('account-1', 'conversation-1', { limit: 20 });

    expect(messages.listByConversation).toHaveBeenCalledWith('conversation-1', { limit: 20 });
  });
});

describe('MessagingService.markRead', () => {
  it('rejects a non-participant', async () => {
    const { service } = buildService({
      conversations: { findByIdForAccount: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.markRead('account-9', 'conversation-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('marks the conversation read for a participant', async () => {
    const { service, conversations } = buildService({});

    await service.markRead('account-1', 'conversation-1');

    expect(conversations.markRead).toHaveBeenCalledWith('conversation-1', 'account-1');
  });
});
