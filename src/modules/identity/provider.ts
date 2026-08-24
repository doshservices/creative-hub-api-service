import type { DocumentType } from './model.js';

// Prembly's document-code vocabulary (doc_type) differs from our own DocumentType — mapped at
// this boundary so the rest of the codebase never has to know Prembly's abbreviations.
// https://docs.prembly.com/docs/document-verification-copy-4
const DOC_TYPE_CODES: Record<DocumentType, string> = {
  national_id: 'ID',
  drivers_license: 'DL',
  passport: 'PP',
};

interface PremblyDocumentVerificationResponse {
  status: boolean;
  response_code?: string;
  message?: string;
  verification?: {
    status?: string;
    reference?: string;
  };
}

export interface PremblyVerificationResult {
  status: 'approved' | 'rejected';
  providerReference: string | null;
  failureReason: string | null;
}

export interface PremblyClientPort {
  submitVerification(input: {
    documentImageBase64: string;
    documentType: DocumentType;
    documentCountry: string;
  }): Promise<PremblyVerificationResult>;
}

// POST /verification/document responds synchronously with the verdict — Prembly's webhooks are
// a separate product (the hosted Identity Widget), not part of this direct-API flow, so there is
// no async callback to wait on here.
// https://docs.prembly.com/docs/document-verification-copy-4
// https://docs.prembly.com/docs/authentication
export class HttpPremblyClient implements PremblyClientPort {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly appId: string,
  ) {}

  async submitVerification(input: {
    documentImageBase64: string;
    documentType: DocumentType;
    documentCountry: string;
  }): Promise<PremblyVerificationResult> {
    const response = await fetch(`${this.baseUrl}/verification/document`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Prembly's docs are explicit: no Authorization header, auth is x-api-key + app-id.
        'x-api-key': this.apiKey,
        'app-id': this.appId,
      },
      body: JSON.stringify({
        doc_type: DOC_TYPE_CODES[input.documentType],
        doc_image: input.documentImageBase64,
        doc_country: input.documentCountry,
      }),
    });

    if (!response.ok) {
      throw new Error(`Prembly submission failed with status ${response.status}`);
    }

    const body = (await response.json()) as PremblyDocumentVerificationResponse;
    const verificationStatus = body.verification?.status;
    const providerReference = body.verification?.reference ?? null;

    if (verificationStatus === 'VERIFIED') {
      return { status: 'approved', providerReference, failureReason: null };
    }
    if (verificationStatus === 'NOT-VERIFIED') {
      return {
        status: 'rejected',
        providerReference,
        failureReason: body.message ?? 'Document could not be verified',
      };
    }
    // PENDING ("verification request has failed and will be retried at a later time", per
    // Prembly's docs) or an unrecognized status — treat as transient so BullMQ retries with
    // backoff, the same as an HTTP-level failure above.
    throw new Error(
      `Prembly verification not final: status=${verificationStatus ?? 'unknown'} code=${body.response_code ?? 'unknown'}`,
    );
  }
}
