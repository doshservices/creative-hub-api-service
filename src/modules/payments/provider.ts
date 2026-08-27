// Flutterwave's v3 REST API. Docs: https://developer.flutterwave.com/docs
//
// Two boundary conversions happen only in this file, never elsewhere in the module:
//  - Amounts: we hold everything in integer minor units (kobo); Flutterwave's API takes and
//    returns amounts in major units (naira, as a decimal). Converted at the edges here.
//  - Webhook auth: Flutterwave does not HMAC-sign webhooks — it compares a static secret hash
//    string sent in the `verif-hash` header against one you configure in the dashboard. See
//    webhook-auth.ts for that check; this file only calls the REST API.

export interface InitiatePaymentInput {
  txRef: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  redirectUrl: string;
}

export interface InitiateTransferInput {
  reference: string;
  amountMinor: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  narration: string;
}

// Both provider calls return a value for a *definitive* provider-side outcome (including a
// business rejection, e.g. an invalid account number) and only throw for a transient failure
// (network error, 5xx, an ambiguous/incomplete response) — mirrors identity/provider.ts's
// PremblyVerificationResult split, so the queue only retries the failures retrying can fix.
export type InitiatePaymentResult =
  | { status: 'accepted'; checkoutUrl: string }
  | { status: 'rejected'; reason: string };

export type InitiateTransferResult =
  | { status: 'accepted'; providerTransferId: string }
  | { status: 'rejected'; reason: string };

export interface VerifyTransactionResult {
  status: 'successful' | 'failed' | 'pending';
  amountMinor: number;
  currency: string;
}

export interface VerifyTransferResult {
  status: 'successful' | 'failed' | 'pending';
}

export interface FlutterwaveClientPort {
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyTransaction(providerTransactionId: string): Promise<VerifyTransactionResult>;
  initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult>;
  verifyTransfer(providerTransferId: string): Promise<VerifyTransferResult>;
}

function toMajorUnits(amountMinor: number): number {
  return amountMinor / 100;
}

// Flutterwave returns amounts as a (possibly float-imprecise) decimal; round to the nearest
// kobo rather than truncating, and never carry the float further than this one conversion.
function toMinorUnits(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

interface FlutterwaveEnvelope<T> {
  status: 'success' | 'error';
  message: string;
  data?: T;
}

async function postJson<T>(
  url: string,
  secretKey: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: FlutterwaveEnvelope<T> }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json()) as FlutterwaveEnvelope<T>;
  return { ok: response.ok, status: response.status, body: parsed };
}

async function getJson<T>(
  url: string,
  secretKey: string,
): Promise<{ ok: boolean; status: number; body: FlutterwaveEnvelope<T> }> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${secretKey}` },
  });
  const parsed = (await response.json()) as FlutterwaveEnvelope<T>;
  return { ok: response.ok, status: response.status, body: parsed };
}

export class HttpFlutterwaveClient implements FlutterwaveClientPort {
  constructor(
    private readonly baseUrl: string,
    private readonly secretKey: string,
  ) {}

  // POST /v3/payments — hosted checkout link. https://developer.flutterwave.com/docs/collecting-payments/standard
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const { ok, status, body } = await postJson<{ link: string }>(
      `${this.baseUrl}/payments`,
      this.secretKey,
      {
        tx_ref: input.txRef,
        amount: toMajorUnits(input.amountMinor),
        currency: input.currency,
        redirect_url: input.redirectUrl,
        customer: { email: input.customerEmail },
      },
    );

    // A 4xx here is a request-shape/business rejection (bad currency, malformed customer,
    // account restriction) — definitive, not worth retrying.
    if (!ok && status >= 400 && status < 500) {
      return { status: 'rejected', reason: body.message };
    }
    if (!ok || body.status !== 'success' || !body.data?.link) {
      throw new Error(`Flutterwave payment initiation failed with status ${status}: ${body.message}`);
    }
    return { status: 'accepted', checkoutUrl: body.data.link };
  }

  // GET /v3/transactions/{id}/verify — https://developer.flutterwave.com/docs/collecting-payments/verify-transactions
  async verifyTransaction(providerTransactionId: string): Promise<VerifyTransactionResult> {
    const { ok, status, body } = await getJson<{
      status: string;
      amount: number;
      currency: string;
    }>(`${this.baseUrl}/transactions/${providerTransactionId}/verify`, this.secretKey);

    if (!ok || body.status !== 'success' || !body.data) {
      throw new Error(`Flutterwave transaction verify failed with status ${status}: ${body.message}`);
    }
    const providerStatus = body.data.status === 'successful' ? 'successful' : 'failed';
    return {
      status: providerStatus,
      amountMinor: toMinorUnits(body.data.amount),
      currency: body.data.currency,
    };
  }

  // POST /v3/transfers — https://developer.flutterwave.com/docs/making-payments/transfers
  async initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult> {
    const { ok, status, body } = await postJson<{ id: number; status: string }>(
      `${this.baseUrl}/transfers`,
      this.secretKey,
      {
        account_bank: input.bankCode,
        account_number: input.accountNumber,
        amount: toMajorUnits(input.amountMinor),
        currency: input.currency,
        reference: input.reference,
        narration: input.narration,
      },
    );

    if (!ok && status >= 400 && status < 500) {
      return { status: 'rejected', reason: body.message };
    }
    if (!ok || body.status !== 'success' || body.data === undefined) {
      throw new Error(`Flutterwave transfer initiation failed with status ${status}: ${body.message}`);
    }
    return { status: 'accepted', providerTransferId: String(body.data.id) };
  }

  // GET /v3/transfers/{id} — https://developer.flutterwave.com/docs/making-payments/transfers
  async verifyTransfer(providerTransferId: string): Promise<VerifyTransferResult> {
    const { ok, status, body } = await getJson<{ status: string }>(
      `${this.baseUrl}/transfers/${providerTransferId}`,
      this.secretKey,
    );

    if (!ok || body.status !== 'success' || !body.data) {
      throw new Error(`Flutterwave transfer verify failed with status ${status}: ${body.message}`);
    }
    const providerStatus = body.data.status === 'SUCCESSFUL' ? 'successful' : 'failed';
    return { status: providerStatus };
  }
}
