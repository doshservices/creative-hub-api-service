const LEDGER_ENTRY_TYPES = ['credit', 'debit', 'hold', 'hold_release', 'hold_capture'] as const;

export const walletQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    currency: { type: 'string', minLength: 3, maxLength: 3 },
  },
} as const;

export const ledgerQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: { type: 'string', pattern: '^[a-f0-9]{24}$' },
  },
} as const;

const walletProperties = {
  id: { type: 'string' },
  accountId: { type: 'string' },
  currency: { type: 'string' },
  balanceMinor: { type: 'integer' },
  heldMinor: { type: 'integer' },
  availableMinor: { type: 'integer' },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const walletResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: walletProperties },
  },
} as const;

const ledgerEntryProperties = {
  id: { type: 'string' },
  walletId: { type: 'string' },
  accountId: { type: 'string' },
  type: { type: 'string', enum: LEDGER_ENTRY_TYPES },
  amountMinor: { type: 'integer' },
  currency: { type: 'string' },
  relatedEntryId: { type: ['string', 'null'] },
  reference: { type: ['string', 'null'] },
  description: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
} as const;

export const ledgerPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: ledgerEntryProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;
