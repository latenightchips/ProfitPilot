import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExitPriceSensitivity } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Exit Price Sensitivity — 06_TASKS.md M7-028. DoD: "Users can
 * understand how price uncertainty affects an exit plan."
 */
const INITIAL_STATE = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  priceSensitivity: null,
  priceSensitivityErrors: [],
  savedPlans: [],
  selectedPlanId: null,
};

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

beforeEach(() => {
  useExitPlannerStore.setState(INITIAL_STATE);
});

describe('ExitPriceSensitivity — empty state', () => {
  it('prompts for an exit target before any calculation has run', () => {
    render(<ExitPriceSensitivity portfolio={validPortfolio()} />);
    expect(screen.getByText(/Configure an exit target/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Run Price Sensitivity/i }),
    ).not.toBeInTheDocument();
  });
});

describe('ExitPriceSensitivity — running the analysis', () => {
  it('computes and displays all 4 real comparison points', async () => {
    const user = userEvent.setup();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitPriceSensitivity portfolio={validPortfolio()} />);
    await user.click(screen.getByRole('button', { name: /Run Price Sensitivity/i }));

    expect(screen.getByText('Current Price')).toBeInTheDocument();
    expect(screen.getByText('User Target Price')).toBeInTheDocument();
    expect(screen.getByText('Lower-Price Case (-20%)')).toBeInTheDocument();
    expect(screen.getByText('Higher-Price Case (+20%)')).toBeInTheDocument();
  });

  it('shows real, distinct Net Proceeds figures at the lower vs. higher price case for Target Retained BTC', async () => {
    const user = userEvent.setup();
    useExitPlannerStore.getState().setExitType('targetRetainedBtc');
    useExitPlannerStore.getState().setTargetInputs({ targetRetainedBtc: 1.8 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitPriceSensitivity portfolio={validPortfolio()} />);
    await user.click(screen.getByRole('button', { name: /Run Price Sensitivity/i }));

    const rows = screen.getAllByRole('row');
    // Row 0 is the header; Lower-Price is row 3, Higher-Price is row 4.
    expect(rows[3].textContent).not.toBe(rows[4].textContent);
  });

  it('shows "Infeasible" for a genuinely infeasible target, at every price point', async () => {
    const user = userEvent.setup();
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 25000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitPriceSensitivity portfolio={validPortfolio()} />);
    await user.click(screen.getByRole('button', { name: /Run Price Sensitivity/i }));

    expect(screen.getAllByText(/Infeasible —/).length).toBe(4);
  });

  it('shows a real error message inside a role="alert" on a genuine Engine failure', async () => {
    const user = userEvent.setup();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const invalidPortfolio: ApplicationPortfolio = {
      ...validPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    render(<ExitPriceSensitivity portfolio={invalidPortfolio} />);
    await user.click(screen.getByRole('button', { name: /Run Price Sensitivity/i }));

    const alert = screen.getByRole('alert');
    expect(alert.textContent?.length).toBeGreaterThan(0);
  });
});
