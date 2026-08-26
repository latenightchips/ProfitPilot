import { describe, expect, it } from 'vitest';

import { resolveAaveClientIdentity } from '@/services/rateLimit/aaveApiRateLimit';

/**
 * `resolveAaveClientIdentity` — R1-2. The Next.js-specific pieces this
 * policy feeds into (`buildAaveRateLimitResponse`/`evaluateAaveApiRequest`)
 * are tested in `tests/unit/middleware.test.ts` instead — this file's
 * own module (`services/rateLimit/aaveApiRateLimit.ts`) is framework-free
 * by construction (M3-001), so nothing here imports `next/server`.
 */
function headersFrom(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('resolveAaveClientIdentity', () => {
  it('uses the first entry of x-forwarded-for', () => {
    const headers = headersFrom({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2' });
    expect(resolveAaveClientIdentity(headers)).toBe('203.0.113.5');
  });

  it('trims whitespace around the first x-forwarded-for entry', () => {
    const headers = headersFrom({ 'x-forwarded-for': '  203.0.113.5  , 10.0.0.1' });
    expect(resolveAaveClientIdentity(headers)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const headers = headersFrom({ 'x-real-ip': '198.51.100.9' });
    expect(resolveAaveClientIdentity(headers)).toBe('198.51.100.9');
  });

  it('falls back to a shared "unknown" bucket when neither header is present', () => {
    const headers = headersFrom({});
    expect(resolveAaveClientIdentity(headers)).toBe('unknown');
  });

  it('falls back to x-real-ip when x-forwarded-for is present but empty', () => {
    const headers = headersFrom({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.9' });
    expect(resolveAaveClientIdentity(headers)).toBe('198.51.100.9');
  });
});
