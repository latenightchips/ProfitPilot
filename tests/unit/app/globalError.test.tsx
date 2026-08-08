import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GlobalError from '@/app/global-error';

/**
 * Root Layout Error Boundary — 06_TASKS.md M9-043. See
 * `tests/unit/app/error.test.tsx`'s own header comment for why this is
 * directly renderable/testable as an ordinary `{ error, reset }`
 * component. `GlobalError` renders its own `<html>`/`<body>` (Next's own
 * requirement for this specific file) — jsdom accepts the resulting
 * nested markup without erroring, so no special test setup is needed
 * beyond querying inside it as usual.
 *
 * `@/services/observability` is mocked (M9-049, Batch 9) — see
 * `tests/unit/app/error.test.tsx`'s own header comment for why.
 */
const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));
vi.mock('@/services/observability', () => ({ captureError }));

describe('GlobalError (app/global-error.tsx)', () => {
  const testError = Object.assign(new Error('a real, unsafe internal message'), {
    digest: undefined,
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    captureError.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never renders the raw Error.message', () => {
    render(<GlobalError error={testError} reset={() => undefined} />);
    expect(screen.queryByText(/a real, unsafe internal message/)).not.toBeInTheDocument();
  });

  it('shows a safe, generic message and a data-safety reassurance', () => {
    render(<GlobalError error={testError} reset={() => undefined} />);
    expect(screen.getByText('The application failed to load.')).toBeInTheDocument();
    expect(screen.getByText(/saved data is stored separately/i)).toBeInTheDocument();
  });

  it('announces the error via role="alert"', () => {
    render(<GlobalError error={testError} reset={() => undefined} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows a diagnostic reference code and logs the real error to the console', () => {
    render(<GlobalError error={testError} reset={() => undefined} />);
    expect(screen.getByText(/Reference code:/)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/^\[.+\]$/), testError);
  });

  it('calls reset() when "Try again" is clicked', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<GlobalError error={testError} reset={reset} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('reports the real error to error monitoring (M9-049)', () => {
    render(<GlobalError error={testError} reset={() => undefined} />);
    expect(captureError).toHaveBeenCalledWith(testError, {
      feature: 'global-error-boundary',
      operation: 'render',
    });
  });
});
