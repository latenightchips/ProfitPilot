import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExitPlanExport } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Exit Plan Export — 06_TASKS.md M7-030. This component only wires
 * `../utils/exportExitPlan.ts`'s own already fully-tested pure
 * functions to two buttons; these tests focus on that wiring.
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubDownload() {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
  const realCreateElement = document.createElement.bind(document);
  const click = vi.fn();
  let anchor: HTMLAnchorElement | undefined;
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    const element = realCreateElement(tagName);
    if (tagName === 'a') {
      element.click = click;
      anchor = element as HTMLAnchorElement;
    }
    return element;
  });
  return { click, anchor: () => anchor };
}

describe('ExitPlanExport — empty state', () => {
  it('prompts the user to configure a plan, rather than rendering export buttons', () => {
    render(<ExitPlanExport portfolio={validPortfolio()} />);
    expect(screen.getByText('Configure an exit plan to export it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument();
  });
});

describe('ExitPlanExport — an active plan', () => {
  function runPlan() {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
  }

  it('renders Export JSON and Export CSV buttons', () => {
    runPlan();
    render(<ExitPlanExport portfolio={validPortfolio()} />);
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('clicking Export JSON triggers a real download with the correct filename', async () => {
    const user = userEvent.setup();
    runPlan();
    const { click, anchor } = stubDownload();

    render(<ExitPlanExport portfolio={validPortfolio()} />);
    await user.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor()?.download).toBe('exit-plan-export.json');
  });

  it('clicking Export CSV triggers a real download with the correct filename', async () => {
    const user = userEvent.setup();
    runPlan();
    const { click, anchor } = stubDownload();

    render(<ExitPlanExport portfolio={validPortfolio()} />);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor()?.download).toBe('exit-plan-export.csv');
  });
});
