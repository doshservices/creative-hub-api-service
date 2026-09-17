import { describe, expect, it } from 'vitest';
import { extractErrorMessage } from '../provider.js';

describe('extractErrorMessage', () => {
  it('uses the documented top-level message field when present', () => {
    expect(extractErrorMessage({ status: 'error', message: 'Invalid account number' }, 400)).toBe(
      'Invalid account number',
    );
  });

  it('falls back to error.message when the top-level message is absent', () => {
    // The real-world shape that caused a withdrawal to land with failureReason: null — a
    // rejection nested under `error.message` instead of the documented top-level `message`.
    expect(
      extractErrorMessage({ status: 'error', error: { type: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401),
    ).toBe('Unauthorized');
  });

  it('falls back to a generated message when neither shape is present, never undefined/null', () => {
    expect(extractErrorMessage({ status: 'error' }, 502)).toBe(
      'Flutterwave returned an unrecognized error shape (HTTP 502)',
    );
  });

  it('prefers the top-level message over error.message when both are present', () => {
    expect(
      extractErrorMessage(
        { status: 'error', message: 'Top-level reason', error: { message: 'Nested reason' } },
        400,
      ),
    ).toBe('Top-level reason');
  });
});
