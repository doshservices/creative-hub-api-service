const preferenceProperties = {
  emailJobOpportunities: { type: 'boolean' },
  emailPaymentNotifications: { type: 'boolean' },
  emailMessages: { type: 'boolean' },
  smsUrgentJobAlerts: { type: 'boolean' },
  smsPaymentConfirmations: { type: 'boolean' },
  inAppAllNotifications: { type: 'boolean' },
} as const;

// A partial update — only the toggles the client sends change; everything else keeps its
// current (or default) value. No `required` list on purpose.
export const updatePreferencesBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: preferenceProperties,
} as const;

export const preferencesResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: preferenceProperties },
  },
} as const;
