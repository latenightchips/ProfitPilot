import { describe, expect, it } from 'vitest';

import { scrubForTelemetry } from '@/services/observability/scrub';

/**
 * Shared telemetry scrubbing — see `services/observability/scrub.ts`'s
 * own header comment. Reuses `services/shared/sensitiveFields.ts`'s own
 * detection, so this test focuses on the scrub-specific behavior
 * (redaction, recursion, non-object passthrough), not re-testing that
 * detection logic itself (already covered by
 * `tests/unit/services/shared/sensitiveFields.test.ts`).
 */
describe('scrubForTelemetry (M9-049/M9-050)', () => {
  it('redacts a top-level credential-shaped key', () => {
    const result = scrubForTelemetry({ apiKey: 'sk-live-abc123', feature: 'settings' });
    expect(result).toEqual({ apiKey: '[redacted]', feature: 'settings' });
  });

  it('redacts a nested credential-shaped key', () => {
    const result = scrubForTelemetry({ result: { wallet: { privateKey: '0xdeadbeef' } } });
    expect(result).toEqual({ result: { wallet: { privateKey: '[redacted]' } } });
  });

  it('redacts inside arrays', () => {
    const result = scrubForTelemetry([{ accessToken: 'abc' }, { feature: 'ok' }]);
    expect(result).toEqual([{ accessToken: '[redacted]' }, { feature: 'ok' }]);
  });

  it('leaves non-sensitive primitives and structure untouched', () => {
    const input = { feature: 'settings', operation: 'import', count: 3, ok: true };
    expect(scrubForTelemetry(input)).toEqual(input);
  });

  it('passes primitives through unchanged', () => {
    expect(scrubForTelemetry('a string')).toBe('a string');
    expect(scrubForTelemetry(42)).toBe(42);
    expect(scrubForTelemetry(null)).toBe(null);
    expect(scrubForTelemetry(undefined)).toBe(undefined);
  });
});
