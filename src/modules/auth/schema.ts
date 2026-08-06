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
        createdAt: { type: 'string' },
      },
    },
  },
} as const;
