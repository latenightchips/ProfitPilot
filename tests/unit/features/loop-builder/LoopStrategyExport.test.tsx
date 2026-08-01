import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoopStrategyExport } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Strategy Export — 06_TASKS.md M7-018. This component only wires
 * `../utils/exportLoopStrategy.ts`'s own already fully-tested pure
 * functions to two buttons; these tests focus on that wiring (empty
 * state, which arguments reach the download trigger), not on
 * re-testing payload/CSV construction.
 */
const INITIAL_STATE = {
  settings: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
  sensitivityResult: null,
  sensitivityErrors: [],
};

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

beforeEach(() => {
  useLoopBuilderStore.setState(INITIAL_STATE);
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

describe('LoopStrategyExport — empty state', () => {
  it('prompts the user to configure a strategy, rather than rendering export buttons', () => {
    render(<LoopStrategyExport portfolio={validPortfolio()} />);
    expect(screen.getByText('Configure a strategy to export it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument();
  });
});

describe('LoopStrategyExport — an active strategy', () => {
  function runStrategy() {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
  }

  it('renders Export JSON and Export CSV buttons', () => {
    runStrategy();
    render(<LoopStrategyExport portfolio={validPortfolio()} />);
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('clicking Export JSON triggers a real download with the correct filename', async () => {
    const user = userEvent.setup();
    runStrategy();
    const { click, anchor } = stubDownload();

    render(<LoopStrategyExport portfolio={validPortfolio()} />);
    await user.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor()?.download).toBe('loop-strategy-export.json');
  });

  it('clicking Export CSV triggers a real download with the correct filename', async () => {
    const user = userEvent.setup();
    runStrategy();
    const { click, anchor } = stubDownload();

    render(<LoopStrategyExport portfolio={validPortfolio()} />);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor()?.download).toBe('loop-strategy-export.csv');
  });
});
