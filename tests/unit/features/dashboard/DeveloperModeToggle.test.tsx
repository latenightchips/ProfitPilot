import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DeveloperModeToggle } from '@/features/dashboard';
import { useDeveloperModeStore } from '@/stores/developerModeStore';

/**
 * Developer Mode Toggle — 06_TASKS.md M5-022.
 */
beforeEach(() => {
  useDeveloperModeStore.setState({ enabled: false });
});

describe('DeveloperModeToggle', () => {
  it('renders unchecked by default', () => {
    render(<DeveloperModeToggle />);
    expect(screen.getByRole('checkbox', { name: 'Developer Mode' })).not.toBeChecked();
  });

  it('toggles the shared store when clicked', async () => {
    const user = userEvent.setup();
    render(<DeveloperModeToggle />);

    await user.click(screen.getByRole('checkbox', { name: 'Developer Mode' }));
    expect(useDeveloperModeStore.getState().enabled).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Developer Mode' })).toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Developer Mode' }));
    expect(useDeveloperModeStore.getState().enabled).toBe(false);
  });
});
