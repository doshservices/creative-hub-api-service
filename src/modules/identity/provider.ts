import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DocumentType } from './model.js';

export interface PremblyClientPort {
  submitVerification(input: {
    reference: string;
    documentUrl: string;
    documentType: DocumentType;
  }): Promise<void>;
}

// Real Prembly integration — endpoint path, payload field names, and response shape are best-
// guess conventions (no sandbox credentials were available while building this) and should be
// reconciled against Prembly's actual API docs before this goes live.
export class HttpPremblyClient implements PremblyClientPort {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async submitVerification(input: {
    reference: string;
    documentUrl: string;
    documentType: DocumentType;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/identity/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        reference: input.reference,
        document_url: input.documentUrl,
        document_type: input.documentType,
      }),
    });

    if (!response.ok) {
      throw new Error(`Prembly submission failed with status ${response.status}`);
    }
  }
}

export interface WebhookSignatureVerifierPort {
  verify(rawBody: Buffer, signature: string | undefined): boolean;
}

// HMAC-SHA256 over the raw request body — the standard pattern the third-party-provider skill
// calls for. Header name and algorithm are conventions pending Prembly's real webhook docs.
export class HmacWebhookSignatureVerifier implements WebhookSignatureVerifierPort {
  constructor(private readonly secret: string) {}

  verify(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;

    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
