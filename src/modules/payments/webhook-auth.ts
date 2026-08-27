import { timingSafeEqual } from 'node:crypto';

// Flutterwave does not sign webhooks with an HMAC over the body — it sends back the exact
// secret hash string you configured in the dashboard in the `verif-hash` header, and you
// compare it verbatim. See https://developer.flutterwave.com/docs/integration-guides/webhooks
export function isValidFlutterwaveWebhook(
  headerValue: string | string[] | undefined,
  configuredSecretHash: string,
): boolean {
  if (typeof headerValue !== 'string' || headerValue.length === 0) {
    return false;
  }
  const received = Buffer.from(headerValue);
  const expected = Buffer.from(configuredSecretHash);
  if (received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(received, expected);
}
