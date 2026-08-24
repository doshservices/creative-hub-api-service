const DOCUMENT_TYPE = ['national_id', 'drivers_license', 'passport'] as const;
const KYC_STATUS = ['pending', 'approved', 'rejected', 'failed'] as const;

export const submitVerificationBodySchema = {
  type: 'object',
  required: ['documentKey', 'documentType', 'documentCountry'],
  additionalProperties: false,
  properties: {
    // S3 object key from a prior POST /users/me/creative-profile/upload-url call — the document
    // itself never passes through this service.
    documentKey: { type: 'string', minLength: 1, maxLength: 1024 },
    documentType: { type: 'string', enum: DOCUMENT_TYPE },
    // ISO 3166-1 alpha-3, e.g. "NGA" — the country that issued the document, required by
    // Prembly's document-verification endpoint.
    documentCountry: { type: 'string', pattern: '^[A-Z]{3}$' },
  },
} as const;

const verificationProperties = {
  id: { type: 'string' },
  accountId: { type: 'string' },
  documentType: { type: 'string', enum: DOCUMENT_TYPE },
  documentCountry: { type: 'string' },
  status: { type: 'string', enum: KYC_STATUS },
  providerReference: { type: ['string', 'null'] },
  failureReason: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const verificationResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: verificationProperties },
  },
} as const;
