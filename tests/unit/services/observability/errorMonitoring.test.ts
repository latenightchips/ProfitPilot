import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Production Error Monitoring — 06_TASKS.md M9-049. `vi.resetModules()` +
 * a fresh dynamic `import()` per test is required for the same reason
 * `tests/unit/env.test.ts`/`tests/unit/next.config.test.ts` already
 * establish: `isErrorMonitoringConfigured()` reads `utils/env.ts`'s
 * module-load-time `env` export, and `errorMonitoring.ts` itself caches
 * `initialized`/`sentryModulePromise` at module scope.
 *
 * `@sentry/nextjs` is mocked entirely — this sandbox has no live Sentry
 * project (`services/observability/errorMonitoring.ts`'s own header
 * comment), so nothing here is verified against a real backend, the
 * same "tested against a fake, never a live account" scope
 * `tests/unit/services/auth/authService.test.ts` already established for
 * Supabase.
 */
const sentryInit = vi.fn();
const sentryCaptureException = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  init: sentryInit,
  captureException: sentryCaptureException,
}));

describe('errorMonitoring (M9-049)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    sentryInit.mockClear();
    sentryCaptureException.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isErrorMonitoringConfigured', () => {
    it("is false when NEXT_PUBLIC_SENTRY_DSN is unset (this sandbox's real state)", async () => {
      const { isErrorMonitoringConfigured } =
        await import('@/services/observability/errorMonitoring');
      expect(isErrorMonitoringConfigured()).toBe(false);
    });

    it('is true once NEXT_PUBLIC_SENTRY_DSN is set', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { isErrorMonitoringConfigured } =
        await import('@/services/observability/errorMonitoring');
      expect(isErrorMonitoringConfigured()).toBe(true);
    });
  });

  describe('initErrorMonitoring', () => {
    it('never calls Sentry.init when unconfigured', async () => {
      const { initErrorMonitoring } = await import('@/services/observability/errorMonitoring');
      initErrorMonitoring();
      await vi.waitFor(() => expect(sentryInit).not.toHaveBeenCalled());
    });

    it('calls Sentry.init with the configured DSN, no tracing, and PII disabled', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { initErrorMonitoring } = await import('@/services/observability/errorMonitoring');
      initErrorMonitoring();
      await vi.waitFor(() => expect(sentryInit).toHaveBeenCalledTimes(1));
      const options = sentryInit.mock.calls[0]?.[0];
      expect(options.dsn).toBe('https://examplekey@o0.ingest.sentry.io/1');
      expect(options.tracesSampleRate).toBe(0);
      expect(options.sendDefaultPii).toBe(false);
    });

    it('does not call Sentry.init a second time on a repeat call', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { initErrorMonitoring } = await import('@/services/observability/errorMonitoring');
      initErrorMonitoring();
      initErrorMonitoring();
      await vi.waitFor(() => expect(sentryInit).toHaveBeenCalledTimes(1));
    });

    it('never surfaces as an unhandled rejection when Sentry.init itself throws (M9-049 pre-commit review)', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      sentryInit.mockImplementation(() => {
        throw new Error('Sentry SDK itself is broken');
      });
      const { initErrorMonitoring } = await import('@/services/observability/errorMonitoring');
      expect(() => initErrorMonitoring()).not.toThrow();
      await vi.waitFor(() => expect(sentryInit).toHaveBeenCalledTimes(1));
      // If the internal `.catch()` guard were missing, an unhandled
      // rejection here would fail this test under Vitest's default
      // unhandled-rejection handling — reaching this line is the proof.
    });
  });

  describe('captureError', () => {
    it('never calls Sentry.captureException when unconfigured', async () => {
      const { captureError } = await import('@/services/observability/errorMonitoring');
      captureError(new Error('boom'), { feature: 'settings' });
      await vi.waitFor(() => expect(sentryCaptureException).not.toHaveBeenCalled());
    });

    it('never surfaces as an unhandled rejection when Sentry.captureException itself throws (M9-049 pre-commit review)', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      sentryCaptureException.mockImplementation(() => {
        throw new Error('Sentry SDK itself is broken');
      });
      const { captureError } = await import('@/services/observability/errorMonitoring');
      expect(() => captureError(new Error('boom'))).not.toThrow();
      await vi.waitFor(() => expect(sentryCaptureException).toHaveBeenCalledTimes(1));
    });

    it('forwards the error and only the narrow context tags when configured', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { captureError } = await import('@/services/observability/errorMonitoring');
      const error = new Error('boom');
      captureError(error, { feature: 'settings', operation: 'import', code: 'X', category: 'y' });
      await vi.waitFor(() => expect(sentryCaptureException).toHaveBeenCalledTimes(1));
      expect(sentryCaptureException).toHaveBeenCalledWith(error, {
        tags: { feature: 'settings', operation: 'import', code: 'X', category: 'y' },
      });
    });

    it('omits absent context fields from the tags object rather than sending undefined', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { captureError } = await import('@/services/observability/errorMonitoring');
      captureError(new Error('boom'));
      await vi.waitFor(() => expect(sentryCaptureException).toHaveBeenCalledTimes(1));
      expect(sentryCaptureException.mock.calls[0]?.[1]).toEqual({ tags: {} });
    });
  });

  describe('beforeSend/beforeBreadcrumb scrubbing', () => {
    it('redacts a credential-shaped key under extra before it would be sent', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { initErrorMonitoring } = await import('@/services/observability/errorMonitoring');
      initErrorMonitoring();
      await vi.waitFor(() => expect(sentryInit).toHaveBeenCalledTimes(1));
      const options = sentryInit.mock.calls[0]?.[0];

      const scrubbed = options.beforeSend({
        extra: { apiKey: 'sk-live-abc', feature: 'settings' },
      });
      expect(scrubbed.extra).toEqual({ apiKey: '[redacted]', feature: 'settings' });
    });

    it('strips request data entirely', async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { initErrorMonitoring } = await import('@/services/observability/errorMonitoring');
      initErrorMonitoring();
      await vi.waitFor(() => expect(sentryInit).toHaveBeenCalledTimes(1));
      const options = sentryInit.mock.calls[0]?.[0];

      const scrubbed = options.beforeSend({ request: { url: 'https://example.com/?x=1' } });
      expect(scrubbed.request).toBeUndefined();
    });

    it("does not scrub event.exception — a documented scope boundary, not an oversight (see errorMonitoring.ts's own header comment)", async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { initErrorMonitoring } = await import('@/services/observability/errorMonitoring');
      initErrorMonitoring();
      await vi.waitFor(() => expect(sentryInit).toHaveBeenCalledTimes(1));
      const options = sentryInit.mock.calls[0]?.[0];

      const exception = { values: [{ value: 'Cannot read properties of undefined' }] };
      const scrubbed = options.beforeSend({ exception });
      expect(scrubbed.exception).toBe(exception);
    });

    it("redacts a credential-shaped key under a breadcrumb's data", async () => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
      const { initErrorMonitoring } = await import('@/services/observability/errorMonitoring');
      initErrorMonitoring();
      await vi.waitFor(() => expect(sentryInit).toHaveBeenCalledTimes(1));
      const options = sentryInit.mock.calls[0]?.[0];

      const scrubbed = options.beforeBreadcrumb({
        data: { sessionToken: 'abc', operation: 'import' },
      });
      expect(scrubbed.data).toEqual({ sessionToken: '[redacted]', operation: 'import' });
    });
  });
});
