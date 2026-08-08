'use client';

import { useEffect, useMemo } from 'react';

import { generateDiagnosticId } from '@/utils/diagnosticId';

/**
 * Root Layout Error Boundary — 06_TASKS.md M9-043 ("Audit Application
 * Error Boundaries"). See `app/error.tsx`'s own header comment for this
 * batch's full task-level reasoning; this file exists for the one class
 * of failure `app/error.tsx` cannot catch — an exception thrown by
 * `app/layout.tsx` itself (or anything it renders unconditionally, e.g.
 * `AppShell`, `AuthProvider`, `PersistenceProvider`) — Next.js's own
 * documented reason `global-error.tsx` must exist as a second, separate
 * file rather than being folded into `error.tsx`.
 *
 * **Renders its own complete `<html>`/`<body>`, deliberately with zero
 * imports from the app's own provider/shell tree** — since the root
 * layout is exactly what might be broken here, this file cannot safely
 * depend on anything that layout also depends on (`AppShell`,
 * `AuthProvider`, `PersistenceProvider`, `next/font`'s `Inter` loader)
 * without risking the same failure recurring inside its own fallback.
 * `className="dark"` on `<html>` and `app/globals.css`'s own CSS
 * variables are still imported (a stylesheet import, not a component
 * render, so it carries no comparable failure risk) so this fallback is
 * legible rather than unstyled black-on-white.
 *
 * Diagnostic ID / safe message / recovery action follow the identical
 * pattern `app/error.tsx` establishes — see that file for the full
 * reasoning. "Try again" here calls `reset()` in the same way; there is
 * no in-app link to render (a broken root layout cannot be trusted to
 * navigate reliably), so recovery is `reset()` or a manual reload.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const diagnosticId = useMemo(() => generateDiagnosticId(), []);

  useEffect(() => {
    console.error(`[${diagnosticId}]`, error);
  }, [error, diagnosticId]);

  return (
    <html lang="en" className="dark">
      <body>
        <div
          role="alert"
          style={{
            maxWidth: '28rem',
            margin: '3rem auto',
            padding: '1.5rem',
            borderRadius: '0.375rem',
            border:
              '1px solid color-mix(in srgb, var(--color-destructive, #ef4444) 40%, transparent)',
            background: 'color-mix(in srgb, var(--color-destructive, #ef4444) 10%, transparent)',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '0.875rem',
            color: 'var(--color-foreground, #e5e5e5)',
          }}
        >
          <p style={{ fontWeight: 500, margin: 0 }}>The application failed to load.</p>
          <p style={{ marginTop: '0.5rem' }}>
            Your saved data is stored separately and is unaffected.
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.75 }}>
            Reference code: {diagnosticId}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border, #404040)',
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'inherit',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
