import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/providers/AuthProvider';
import { useAuthStore } from '@/stores/authStore';

/**
 * Auth Provider — Milestone 8 Batch 5 (M8-014–M8-021). Mirrors
 * `PersistenceProvider.test.tsx`'s own pattern: `authStore`'s own
 * `initialize` action is replaced with a spy here — this test proves the
 * Provider calls it exactly once on mount, not that initialization
 * itself works (`authStore.test.ts`'s own suite already covers that).
 */
describe('AuthProvider (M8-014–M8-021)', () => {
  beforeEach(() => {
    useAuthStore.setState({ initialize: vi.fn(async () => {}) });
  });

  it('renders its children unchanged', () => {
    render(
      <AuthProvider>
        <div>child content</div>
      </AuthProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('calls initialize exactly once on mount', async () => {
    render(
      <AuthProvider>
        <div>child content</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().initialize).toHaveBeenCalledTimes(1);
    });
  });
});
