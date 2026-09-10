// additionalProperties: false (combined with Fastify's default removeAdditional ajv config)
// strips any client-supplied fields outside this shape — a request body can never smuggle in
// `permissions`, `status`, or any other server-controlled field.
export const registerBodySchema = {
  type: 'object',
  required: ['email', 'password', 'firstName', 'lastName', 'accountType'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    firstName: { type: 'string', minLength: 1, maxLength: 100 },
    lastName: { type: 'string', minLength: 1, maxLength: 100 },
    // 'client' hires; 'creative' gets hired — see the Choice screen in the frontend.
    accountType: { type: 'string', enum: ['client', 'creative'] },
  },
} as const;

export const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
  },
} as const;

export const refreshBodySchema = {
  type: 'object',
  required: ['refreshToken'],
  additionalProperties: false,
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
} as const;

export const authTokensResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'string' },
      },
    },
  },
} as const;

// Login returns EITHER full tokens OR a two-factor challenge — the property lists are just the
// union of both shapes; only whichever the service actually returned gets serialized.
export const loginResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'string' },
        requiresTwoFactor: { type: 'boolean' },
        twoFactorToken: { type: 'string' },
      },
    },
  },
} as const;

export const verifyTwoFactorLoginBodySchema = {
  type: 'object',
  required: ['twoFactorToken', 'code'],
  additionalProperties: false,
  properties: {
    twoFactorToken: { type: 'string', minLength: 1 },
    code: { type: 'string', minLength: 1, maxLength: 20 },
  },
} as const;

export const setupTwoFactorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        secret: { type: 'string' },
        otpauthUrl: { type: 'string' },
      },
    },
  },
} as const;

export const enableTwoFactorBodySchema = {
  type: 'object',
  required: ['code'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', pattern: '^\\d{6}$' },
  },
} as const;

export const enableTwoFactorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        backupCodes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;

export const disableTwoFactorBodySchema = {
  type: 'object',
  required: ['password', 'code'],
  additionalProperties: false,
  properties: {
    password: { type: 'string', minLength: 8, maxLength: 128 },
    code: { type: 'string', minLength: 1, maxLength: 20 },
  },
} as const;

export const changePasswordBodySchema = {
  type: 'object',
  required: ['currentPassword', 'newPassword'],
  additionalProperties: false,
  properties: {
    currentPassword: { type: 'string', minLength: 8, maxLength: 128 },
    newPassword: { type: 'string', minLength: 8, maxLength: 128 },
  },
} as const;

export const accountResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        accountType: { type: 'string', enum: ['client', 'creative'] },
        permissions: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['active', 'suspended'] },
        twoFactorEnabled: { type: 'boolean' },
        createdAt: { type: 'string' },
      },
    },
  },
} as const;
