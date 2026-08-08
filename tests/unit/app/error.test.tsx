import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RouteError from '@/app/error';

/**
 * Application Error Boundary — 06_TASKS.md M9-043 ("Audit Application
 * Error Boundaries"). `app/error.tsx` is an ordinary React component
 * taking `{ error, reset }` props (Next.js App Router's own file-based
 * error-boundary convention) — directly renderable/testable without
 * needing to actually trigger a render crash through the App Router
 * itself, the same way any other component in this codebase is tested.
 */
describe('RouteError (app/error.tsx)', () => {
  const testError = Object.assign(new Error('a real, unsafe internal message'), {
    digest: undefined,
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never renders the raw Error.message', () => {
    render(<RouteError error={testError} reset={() => undefined} />);
    expect(screen.queryByText(/a real, unsafe internal message/)).not.toBeInTheDocument();
  });

  it('shows a safe, generic message and a data-safety reassurance', () => {
    render(<RouteError error={testError} reset={() => undefined} />);
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByText(/saved data is stored separately/i)).toBeInTheDocument();
  });

  it('announces the error via role="alert"', () => {
    render(<RouteError error={testError} reset={() => undefined} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows a diagnostic reference code and logs the real error to the console', () => {
    render(<RouteError error={testError} reset={() => undefined} />);
    expect(screen.getByText(/Reference code:/)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/^\[.+\]$/), testError);
  });

  it('a different render produces a different diagnostic code (not a hardcoded constant)', () => {
    const { unmount } = render(<RouteError error={testError} reset={() => undefined} />);
    const first = screen.getByText(/Reference code:/).textContent;
    unmount();
    render(<RouteError error={testError} reset={() => undefined} />);
    const second = screen.getByText(/Reference code:/).textContent;
    expect(first).not.toEqual(second);
  });

  it('calls reset() when "Try again" is clicked', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<RouteError error={testError} reset={reset} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('offers a link back to the Dashboard', () => {
    render(<RouteError error={testError} reset={() => undefined} />);
    expect(screen.getByRole('link', { name: 'Return to Dashboard' })).toHaveAttribute('href', '/');
  });
});
