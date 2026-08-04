import { describe, expect, it } from 'vitest';

import { applyValidatedImport, previewImport } from '@/services/import/ImportService';
import { APP_NAME, APP_VERSION, STORAGE_SCHEMA_VERSION } from '@/services/persistence';
import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createEnvelope } from '@/services/persistence/envelope';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import type { PersistenceAdapter } from '@/services/persistence/types';

function validFullBackupFile() {
  return {
    app: APP_NAME,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: '2026-03-15T12:00:00.000Z',
    kind: 'full-backup' as const,
    records: {},
  };
}

describe('previewImport', () => {
  it('propagates a file-level validation failure without reading existing ids', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await previewImport('{not json', 'addAsNew', { service });
    expect(result.ok).toBe(false);
  });

  it('propagates a listEnvelopes failure while reading existing ids', async () => {
    const failure = {
      ok: false as const,
      errors: [
        {
          category: 'persistence' as const,
          code: 'SIMULATED_FAILURE',
          message: 'Simulated failure.',
        },
      ],
    };
    const failingAdapter: PersistenceAdapter = {
      ...createMemoryAdapter(),
      list: async () => failure,
    };
    const service = createPersistenceService(failingAdapter);

    const result = await previewImport(JSON.stringify(validFullBackupFile()), 'addAsNew', {
      service,
    });
    expect(result.ok).toBe(false);
  });

  it('builds a preview against existing local data for a valid file', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await previewImport(JSON.stringify(validFullBackupFile()), 'addAsNew', {
      service,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.preview.mergeMode).toBe('addAsNew');
  });
});

describe('applyValidatedImport', () => {
  it('delegates to applyImport with the validation result’s records and issues', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const envelope = createEnvelope('loopStrategy', 'strategy-1', {
      id: 'strategy-1',
      name: 'Strategy',
      portfolioId: 'p1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
      settings: {},
      result: {},
      warnings: [],
      metadata: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await applyValidatedImport(
      { file: validFullBackupFile(), validRecordsByType: { loopStrategy: [envelope] }, issues: [] },
      'addAsNew',
      { service },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.written).toHaveLength(1);
  });
});
