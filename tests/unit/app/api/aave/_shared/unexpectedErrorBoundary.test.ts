import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureError, logDiagnosticEvent, buildDiagnosticEvent } = vi.hoisted(() => ({
  captureError: vi.fn(),
  logDiagnosticEvent: vi.fn(),
  buildDiagnosticEvent: vi.fn((input: unknown) => input),
}));
vi.mock('@/services/observability', () => ({
  captureError,
  logDiagnosticEvent,
  buildDiagnosticEvent,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * `withUnexpectedErrorBoundary` — R2-1. Tests the shared boundary in
 * complete isolation from any real route, adapter, or Next.js runtime
 * concern: a fake `handler` that either resolves normally or throws,
 * and a fake `fallback` that returns a recognizable sentinel response.
 */
describe('withUnexpectedErrorBoundary', () => {
  it('returns the handler’s own response unchanged when it does not throw', async () => {
    const { withUnexpectedErrorBoundary } =
      await import('@/app/api/aave/_shared/unexpectedErrorBoundary');
    const handlerResponse = NextResponse.json({ ok: true, data: 'real' });
    const handler = vi.fn().mockResolvedValue(handlerResponse);
    const fallback = vi.fn();

    const result = await withUnexpectedErrorBoundary('reserve', 'CODE_X', handler, fallback);

    expect(result).toBe(handlerResponse);
    expect(fallback).not.toHaveBeenCalled();
    expect(captureError).not.toHaveBeenCalled();
    expect(logDiagnosticEvent).not.toHaveBeenCalled();
  });

  it('calls the fallback and returns its response when the handler throws', async () => {
    const { withUnexpectedErrorBoundary } =
      await import('@/app/api/aave/_shared/unexpectedErrorBoundary');
    const fallbackResponse = NextResponse.json({ ok: false }, { status: 500 });
    const handler = vi.fn().mockRejectedValue(new Error('boom — something nobody classified'));
    const fallback = vi.fn().mockReturnValue(fallbackResponse);

    const result = await withUnexpectedErrorBoundary('reserve', 'CODE_X', handler, fallback);

    expect(result).toBe(fallbackResponse);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('reports the exception via captureError, tagged with the route name and fallback code', async () => {
    const { withUnexpectedErrorBoundary } =
      await import('@/app/api/aave/_shared/unexpectedErrorBoundary');
    const thrown = new Error('boom');
    const handler = vi.fn().mockRejectedValue(thrown);
    const fallback = vi.fn().mockReturnValue(NextResponse.json({ ok: false }, { status: 500 }));

    await withUnexpectedErrorBoundary('v4-position', 'AAVE_V4_UNEXPECTED_ERROR', handler, fallback);

    expect(captureError).toHaveBeenCalledWith(thrown, {
      feature: 'api',
      operation: 'v4-position',
      code: 'AAVE_V4_UNEXPECTED_ERROR',
    });
  });

  it('logs a structured diagnostic event for the exception, distinct per route', async () => {
    const { withUnexpectedErrorBoundary } =
      await import('@/app/api/aave/_shared/unexpectedErrorBoundary');
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const fallback = vi.fn().mockReturnValue(NextResponse.json({ ok: false }, { status: 500 }));

    await withUnexpectedErrorBoundary(
      'v4-collateral-risk',
      'AAVE_V4_UNEXPECTED_ERROR',
      handler,
      fallback,
    );

    expect(logDiagnosticEvent).toHaveBeenCalledTimes(1);
    expect(buildDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'provider',
        code: 'AAVE_V4_UNEXPECTED_ERROR',
        feature: 'api',
        operation: 'v4-collateral-risk',
        outcome: 'failure',
      }),
    );
  });

  it('never passes the thrown error itself (message/stack) to the fallback response builder', async () => {
    const { withUnexpectedErrorBoundary } =
      await import('@/app/api/aave/_shared/unexpectedErrorBoundary');
    const handler = vi.fn().mockRejectedValue(new Error('sensitive internal detail'));
    const fallback = vi.fn().mockReturnValue(NextResponse.json({ ok: false }, { status: 500 }));

    await withUnexpectedErrorBoundary('reserve', 'CODE_X', handler, fallback);

    // The fallback builder is a zero-argument function — the boundary has
    // no way to thread the thrown value into whatever response it builds.
    expect(fallback).toHaveBeenCalledWith();
  });

  it('lets a classified (non-throwing) failure response pass through untouched, with no diagnostics fired', async () => {
    const { withUnexpectedErrorBoundary } =
      await import('@/app/api/aave/_shared/unexpectedErrorBoundary');
    const classifiedFailure = NextResponse.json(
      { ok: false, error: { code: 'AAVE_RPC_NETWORK_ERROR' } },
      { status: 503 },
    );
    const handler = vi.fn().mockResolvedValue(classifiedFailure);
    const fallback = vi.fn();

    const result = await withUnexpectedErrorBoundary('reserve', 'CODE_X', handler, fallback);

    expect(result).toBe(classifiedFailure);
    expect(captureError).not.toHaveBeenCalled();
    expect(logDiagnosticEvent).not.toHaveBeenCalled();
  });
});
