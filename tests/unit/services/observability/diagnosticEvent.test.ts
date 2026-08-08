import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Structured Diagnostic Logging — 06_TASKS.md M9-050. Same
 * `vi.resetModules()`/mocked-`@sentry/nextjs` approach as
 * `errorMonitoring.test.ts` — see that file's own header comment.
 */
const sentryCaptureMessage = vi.fn();
const sentryAddBreadcrumb = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureMessage: sentryCaptureMessage,
  addBreadcrumb: sentryAddBreadcrumb,
}));

describe('buildDiagnosticEvent (M9-050)', () => {
  it('includes the required fields with the real application version', async () => {
    const { buildDiagnosticEvent } = await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      code: 'INVALID_IMPORT_FILE',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'failure',
    });
    expect(event.category).toBe('import');
    expect(event.code).toBe('INVALID_IMPORT_FILE');
    expect(event.appVersion).toBe('0.1.0');
    expect(event.feature).toBe('settings');
    expect(event.operation).toBe('importFile');
    expect(event.outcome).toBe('failure');
    expect(typeof event.timestamp).toBe('string');
  });

  it('omits engineVersion/formulaVersion when not given ("where relevant")', async () => {
    const { buildDiagnosticEvent } = await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'success',
    });
    expect(event.engineVersion).toBeUndefined();
    expect(event.formulaVersion).toBeUndefined();
  });

  it('includes engineVersion/formulaVersion when given', async () => {
    const { buildDiagnosticEvent } = await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'calculation',
      feature: 'dashboard',
      operation: 'calculatePortfolioSummary',
      outcome: 'failure',
      engineVersion: '0.1.0',
      formulaVersion: '1.0',
    });
    expect(event.engineVersion).toBe('0.1.0');
    expect(event.formulaVersion).toBe('1.0');
  });

  it('defaults code to null rather than an empty string', async () => {
    const { buildDiagnosticEvent } = await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'success',
    });
    expect(event.code).toBeNull();
  });

  it('sanitizes context before it ever reaches the returned event', async () => {
    const { buildDiagnosticEvent } = await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'failure',
      context: { recordType: 'portfolio', accessToken: 'abc123' },
    });
    expect(event.context).toEqual({ recordType: 'portfolio', accessToken: '[redacted]' });
  });
});

describe('logDiagnosticEvent (M9-050)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    sentryCaptureMessage.mockClear();
    sentryAddBreadcrumb.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /**
   * `logDiagnosticEvent`'s Sentry-forwarding path is a 2-level dynamic
   * `import()` chain (`./errorMonitoring`, then `@sentry/nextjs`); every
   * test that triggers it must let that chain fully settle before
   * finishing, or its resolution can land during the *next* test's
   * window instead (a real flake found by running this file — a stray
   * extra call showed up in a later test even though each test's own
   * assertions were individually correct) — found via `vi.waitFor`
   * seeing more calls than the single one that test itself triggered.
   */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('always logs a failure event to console.error', async () => {
    const { buildDiagnosticEvent, logDiagnosticEvent } =
      await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'failure',
    });
    logDiagnosticEvent(event);
    expect(console.error).toHaveBeenCalledWith('[diagnostic]', event);
    await settle();
  });

  it('always logs a success event to console.info', async () => {
    const { buildDiagnosticEvent, logDiagnosticEvent } =
      await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'success',
    });
    logDiagnosticEvent(event);
    expect(console.info).toHaveBeenCalledWith('[diagnostic]', event);
    await settle();
  });

  it('never forwards to Sentry when error monitoring is unconfigured', async () => {
    const { buildDiagnosticEvent, logDiagnosticEvent } =
      await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'failure',
    });
    logDiagnosticEvent(event);
    await settle();
    expect(sentryCaptureMessage).not.toHaveBeenCalled();
    expect(sentryAddBreadcrumb).not.toHaveBeenCalled();
  });

  it('forwards a failure event as a captured message when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
    const { buildDiagnosticEvent, logDiagnosticEvent } =
      await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      code: 'INVALID_IMPORT_FILE',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'failure',
    });
    logDiagnosticEvent(event);
    await vi.waitFor(() => expect(sentryCaptureMessage).toHaveBeenCalledTimes(1));
    expect(sentryCaptureMessage).toHaveBeenCalledWith('import: importFile failed', {
      level: 'warning',
      tags: { feature: 'settings', category: 'import', code: 'INVALID_IMPORT_FILE' },
      extra: { context: {} },
    });
    await settle();
  });

  it('forwards a success event as a breadcrumb when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
    const { buildDiagnosticEvent, logDiagnosticEvent } =
      await import('@/services/observability/diagnosticEvent');
    const event = buildDiagnosticEvent({
      category: 'import',
      feature: 'settings',
      operation: 'importFile',
      outcome: 'success',
    });
    logDiagnosticEvent(event);
    await vi.waitFor(() => expect(sentryAddBreadcrumb).toHaveBeenCalledTimes(1));
    expect(sentryAddBreadcrumb).toHaveBeenCalledWith({
      category: 'import',
      message: 'settings: importFile',
      level: 'info',
      data: {},
    });
    await settle();
  });
});
