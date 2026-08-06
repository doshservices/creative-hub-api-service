export interface ConversationDTO {
  id: string;
  otherAccountId: string;
  lastMessageAt: Date;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface ConversationPage {
  items: ConversationDTO[];
  nextCursor: string | null;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  senderAccountId: string;
  content: string;
  createdAt: Date;
}

export interface MessagePage {
  items: MessageDTO[];
  nextCursor: string | null;
}
