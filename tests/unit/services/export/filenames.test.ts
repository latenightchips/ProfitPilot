import { describe, expect, it } from 'vitest';

import { buildExportFilename } from '@/services/export/filenames';

describe('buildExportFilename', () => {
  const fixedNow = () => new Date('2026-03-15T12:00:00.000Z');

  it('builds a full-backup filename with app, kind, date, and version', () => {
    const filename = buildExportFilename({
      kind: 'full-backup',
      schemaVersion: '1.0.0',
      extension: 'json',
      now: fixedNow,
    });
    expect(filename).toBe('ProfitPilot_full-backup_2026-03-15_v1.0.0.json');
  });

  it('includes a sanitized name segment when provided', () => {
    const filename = buildExportFilename({
      kind: 'loopStrategy',
      name: 'My Strategy!',
      schemaVersion: '1.0.0',
      extension: 'json',
      now: fixedNow,
    });
    expect(filename).toBe('ProfitPilot_loopStrategy_My-Strategy_2026-03-15_v1.0.0.json');
  });

  it('omits the name segment when name is blank', () => {
    const filename = buildExportFilename({
      kind: 'portfolio',
      name: '   ',
      schemaVersion: '1.0.0',
      extension: 'json',
      now: fixedNow,
    });
    expect(filename).toBe('ProfitPilot_portfolio_2026-03-15_v1.0.0.json');
  });

  it('uses the csv extension when requested', () => {
    const filename = buildExportFilename({
      kind: 'portfolio-positions',
      schemaVersion: '1.0.0',
      extension: 'csv',
      now: fixedNow,
    });
    expect(filename).toBe('ProfitPilot_portfolio-positions_2026-03-15_v1.0.0.csv');
  });

  it('truncates and sanitizes an overly long or unsafe name', () => {
    const filename = buildExportFilename({
      kind: 'loopStrategy',
      name: 'a'.repeat(80) + '/*weird*/',
      schemaVersion: '1.0.0',
      extension: 'json',
      now: fixedNow,
    });
    expect(filename.length).toBeLessThan(120);
    expect(filename).not.toMatch(/[/*]/);
  });
});
