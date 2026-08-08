import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/app/settings/page';
import { authService } from '@/services/auth';
import { persistenceService } from '@/services/persistence';
import { useAuthStore } from '@/stores/authStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

vi.mock('@/services/auth', () => ({
  authService: {
    checkAvailability: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    completePasswordReset: vi.fn(),
  },
}));

const mockAuthService = vi.mocked(authService);

/** M9-050 — see `app/settings/SettingsPageClient.tsx`'s own header comment for why this is the one place this batch wires structured diagnostic logging. */
const { logDiagnosticEvent } = vi.hoisted(() => ({ logDiagnosticEvent: vi.fn() }));
vi.mock('@/services/observability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/observability')>();
  return { ...actual, logDiagnosticEvent };
});

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
  useAuthStore.setState({ user: null, status: 'idle', errors: [], cloudSyncEligible: false });
  vi.clearAllMocks();
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

  it('shows a readable error for a corrupted file and logs a diagnostic event (M9-050)', async () => {
    render(<SettingsPage />);
    const file = new File(['{not valid json'], 'bad.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import file/i);
    await userEvent.upload(input, file);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(logDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'import',
        feature: 'settings',
        operation: 'previewImport',
        outcome: 'failure',
      }),
    );
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

describe('SettingsPage — storage, sync, and recovery snapshots (M8-047)', () => {
  it('shows the storage mode and an honest sync-state message', async () => {
    render(<SettingsPage />);
    expect(screen.getByText(/storage mode: local storage/i)).toBeInTheDocument();
    expect(screen.getByText(/sync state: local only/i)).toBeInTheDocument();
  });

  it('shows "No recovery snapshots yet" when none exist', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText(/no recovery snapshots yet/i)).toBeInTheDocument());
  });

  it('lists a recovery snapshot created by a replaceAll import and can restore it', async () => {
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
    await userEvent.click(screen.getByRole('checkbox', { name: /permanently replace/i }));
    await userEvent.click(await screen.findByRole('button', { name: /confirm import/i }));

    await waitFor(() => expect(screen.getByText(/imported \d+ record/i)).toBeInTheDocument());

    const snapshotRadio = await screen.findByRole('radio', { name: /full-replacement/i });
    await userEvent.click(snapshotRadio);
    await userEvent.click(
      screen.getByRole('checkbox', { name: /replace all current local data/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /restore selected snapshot/i }));

    await waitFor(() =>
      expect(screen.getByText(/recovery snapshot restored/i)).toBeInTheDocument(),
    );
  });
});

describe('SettingsPage — clear local data (M8-048)', () => {
  it('disables Clear Local Data until the confirmation checkbox is checked, then clears', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    render(<SettingsPage />);

    const clearButton = screen.getByRole('button', { name: /^clear local data$/i });
    expect(clearButton).toBeDisabled();

    await userEvent.click(
      screen.getByRole('checkbox', { name: /permanently delete all local profitpilot data/i }),
    );
    expect(clearButton).toBeEnabled();

    await userEvent.click(clearButton);

    await waitFor(() => expect(screen.getByText(/local data cleared/i)).toBeInTheDocument());

    const list = await persistenceService.list('portfolio');
    expect(list.ok && list.data).toHaveLength(0);
  });
});

describe('SettingsPage — Account (Milestone 8 Batch 5, M8-020/M8-021)', () => {
  it('shows Sign In and Create Account links when signed out, and explains accounts are optional', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/accounts are optional/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Create Account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });

  it('shows the signed-in email; plain Sign Out preserves local data', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com' },
      status: 'authenticated',
      errors: [],
      cloudSyncEligible: true,
    });
    mockAuthService.signOut.mockResolvedValue({ ok: true, data: undefined });

    render(<SettingsPage />);
    expect(screen.getByText(/signed in as user@example.com/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

    await waitFor(() =>
      expect(screen.getByText(/signed out\. your local data was not changed/i)).toBeInTheDocument(),
    );
    const list = await persistenceService.list('portfolio');
    expect(list.ok && list.data).toHaveLength(1);
  });

  it('Sign Out and Clear Local Data is disabled until confirmed, then clears local data', async () => {
    await persistenceService.write('portfolio', 'portfolio-1', samplePortfolio());
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com' },
      status: 'authenticated',
      errors: [],
      cloudSyncEligible: true,
    });
    mockAuthService.signOut.mockResolvedValue({ ok: true, data: undefined });

    render(<SettingsPage />);
    const destructiveButton = screen.getByRole('button', { name: 'Sign Out and Clear Local Data' });
    expect(destructiveButton).toBeDisabled();

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /also permanently delete all local profitpilot data/i,
      }),
    );
    expect(destructiveButton).toBeEnabled();

    await userEvent.click(destructiveButton);

    await waitFor(() =>
      expect(screen.getByText(/signed out and local data cleared/i)).toBeInTheDocument(),
    );
    const list = await persistenceService.list('portfolio');
    expect(list.ok && list.data).toHaveLength(0);
  });

  it('shows an auth error when sign-out fails', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com' },
      status: 'authenticated',
      errors: [],
      cloudSyncEligible: true,
    });
    mockAuthService.signOut.mockResolvedValue({
      ok: false,
      errors: [
        { category: 'authentication', code: 'SIGN_OUT_FAILED', message: 'Sign-out failed.' },
      ],
    });

    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sign-out failed/i);
  });
});
