import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/app/settings/page';
import { persistenceService } from '@/services/persistence';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Settings — 06_TASKS.md M8-042/M8-043/M8-044. See `app/settings/page.tsx`'s
 * own header comment for why this route exists at all in this batch (a
 * documented, minimal resolution of a 03_UI.md/06_TASKS.md conflict).
 */
function samplePortfolio(): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  window.localStorage.clear();
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockDownload() {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

  const click = vi.fn();
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    const element = realCreateElement(tagName);
    if (tagName === 'a') element.click = click;
    return element;
  });

  return { createObjectURL, click };
}

describe('SettingsPage — export', () => {
  it('renders the Full Backup and CSV export buttons', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /full backup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /portfolio positions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scenario comparisons/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /loop steps/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exit plan breakdowns/i })).toBeInTheDocument();
  });

  it('Full Backup triggers a real download containing the seeded portfolio', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    const { createObjectURL, click } = mockDownload();

    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: /full backup/i }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const content = await blob.text();
    expect(JSON.parse(content).records.portfolio[0].payload.name).toBe('My Portfolio');
  });

  it('a CSV export button triggers a real CSV download', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    const { createObjectURL, click } = mockDownload();

    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: /portfolio positions/i }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('text/csv');
    const content = await blob.text();
    expect(content).toContain('portfolio-1');
    expect(screen.getByRole('status')).toHaveTextContent(/exported/i);
  });
});

describe('SettingsPage — import preview', () => {
  it('shows file version, exported date, and portfolio count for a valid file', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    const { exportFullBackup } = await import('@/services/export');
    const exported = await exportFullBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    window.localStorage.clear();
    render(<SettingsPage />);

    const file = new File([exported.data.content], 'backup.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import file/i);
    await userEvent.upload(input, file);

    await waitFor(() => expect(screen.getByText(/portfolios in file: 1/i)).toBeInTheDocument());
    expect(screen.getByText(/file schema version/i)).toBeInTheDocument();
    expect(screen.getByText(/exported at/i)).toBeInTheDocument();
  });

  it('shows a readable error for a corrupted file', async () => {
    render(<SettingsPage />);
    const file = new File(['{not valid json'], 'bad.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import file/i);
    await userEvent.upload(input, file);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('disables Confirm Import in replaceAll mode until the confirmation checkbox is checked', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    const { exportFullBackup } = await import('@/services/export');
    const exported = await exportFullBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    render(<SettingsPage />);
    const file = new File([exported.data.content], 'backup.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import file/i);
    await userEvent.upload(input, file);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /replace all local data/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('radio', { name: /replace all local data/i }));

    const confirmButton = await screen.findByRole('button', { name: /confirm import/i });
    expect(confirmButton).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /permanently replace/i }));
    expect(confirmButton).toBeEnabled();
  });

  it('applies an addAsNew import and shows a result summary', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    const { exportFullBackup } = await import('@/services/export');
    const exported = await exportFullBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    render(<SettingsPage />);
    const file = new File([exported.data.content], 'backup.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import file/i);
    await userEvent.upload(input, file);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /add as new/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('radio', { name: /add as new/i }));

    const confirmButton = await screen.findByRole('button', { name: /confirm import/i });
    await userEvent.click(confirmButton);

    await waitFor(() => expect(screen.getByText(/imported 1 record/i)).toBeInTheDocument());
  });

  it('replaceSelected mode lists the conflict and replaces only the checked record', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    const { exportFullBackup } = await import('@/services/export');
    const exported = await exportFullBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    // Local data is left in place deliberately so the imported "portfolio-1"
    // conflicts with the one already stored — exercising the conflict list
    // and per-record selection checkbox, not just a clean merge.
    render(<SettingsPage />);
    const file = new File([exported.data.content], 'backup.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import file/i);
    await userEvent.upload(input, file);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /replace selected/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('radio', { name: /replace selected/i }));

    const conflictCheckbox = await screen.findByRole(
      'checkbox',
      { name: /portfolio: portfolio-1/i },
      { timeout: 3000 },
    );
    await userEvent.click(conflictCheckbox);

    const confirmButton = await screen.findByRole('button', { name: /confirm import/i });
    await userEvent.click(confirmButton);

    await waitFor(() => expect(screen.getByText(/imported 1 record/i)).toBeInTheDocument());
  });

  it('shows warnings for a duplicate record id within the file', async () => {
    const portfolioEnvelope = {
      app: 'ProfitPilot',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      recordType: 'portfolio',
      recordId: 'portfolio-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      checksum: 'abcd1234',
      payload: samplePortfolio(),
    };
    const file = {
      app: 'ProfitPilot',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      exportedAt: '2026-03-15T12:00:00.000Z',
      kind: 'full-backup',
      records: { portfolio: [portfolioEnvelope, portfolioEnvelope] },
    };

    render(<SettingsPage />);
    const uploadFile = new File([JSON.stringify(file)], 'dup.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import file/i);
    await userEvent.upload(input, uploadFile);

    await waitFor(() => expect(screen.getByText(/^warnings$/i)).toBeInTheDocument());
  });
});
