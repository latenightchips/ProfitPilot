import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createEnvelope } from '@/services/persistence/envelope';
import type { PersistenceAdapter } from '@/services/persistence/types';

/**
 * In-memory Persistence Adapter — 06_TASKS.md M8-001's own suggested
 * structure. Exercises the full `PersistenceAdapter` contract every
 * future adapter (`LocalStorageAdapter`, M8-006; `SupabaseAdapter`,
 * M8-025) must also satisfy.
 */
describe('createMemoryAdapter (M8-001)', () => {
  let adapter: PersistenceAdapter;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  it('reports itself available', () => {
    expect(adapter.checkAvailability()).toEqual({ available: true });
  });

  it('returns null, not an error, for a record that was never written', async () => {
    const result = await adapter.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('round-trips a written record through read', async () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });
    await adapter.write('preferences', 'singleton', envelope);
    const result = await adapter.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: envelope });
  });

  it('overwrites a record written twice under the same id', async () => {
    const first = createEnvelope('preferences', 'singleton', { developerModeEnabled: false });
    const second = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });
    await adapter.write('preferences', 'singleton', first);
    await adapter.write('preferences', 'singleton', second);
    const result = await adapter.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: second });
  });

  it('deletes a record', async () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });
    await adapter.write('preferences', 'singleton', envelope);
    await adapter.delete('preferences', 'singleton');
    const result = await adapter.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('deleting a record that never existed is a safe no-op', async () => {
    const result = await adapter.delete('preferences', 'never-written');
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('lists every record under a record type', async () => {
    const a = createEnvelope('loopStrategy', 'a', { id: 'a' });
    const b = createEnvelope('loopStrategy', 'b', { id: 'b' });
    await adapter.write('loopStrategy', 'a', a);
    await adapter.write('loopStrategy', 'b', b);

    const result = await adapter.list('loopStrategy');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data).toEqual(expect.arrayContaining([a, b]));
  });

  it('keeps record types independent — writing under one never appears under another', async () => {
    const envelope = createEnvelope('loopStrategy', 'shared-id', { id: 'shared-id' });
    await adapter.write('loopStrategy', 'shared-id', envelope);

    const exitPlans = await adapter.list('exitPlan');
    expect(exitPlans).toEqual({ ok: true, data: [] });
  });

  it('bulkWrite stores every envelope keyed by its own recordId', async () => {
    const a = createEnvelope('simulation', 'a', { id: 'a' });
    const b = createEnvelope('simulation', 'b', { id: 'b' });
    await adapter.bulkWrite('simulation', [a, b]);

    const result = await adapter.list('simulation');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
  });

  it('clear removes every record across every record type', async () => {
    await adapter.write('preferences', 'singleton', createEnvelope('preferences', 'singleton', {}));
    await adapter.write('portfolio', 'p1', createEnvelope('portfolio', 'p1', {}));

    await adapter.clear();

    expect(await adapter.read('preferences', 'singleton')).toEqual({ ok: true, data: null });
    expect(await adapter.read('portfolio', 'p1')).toEqual({ ok: true, data: null });
  });
});
