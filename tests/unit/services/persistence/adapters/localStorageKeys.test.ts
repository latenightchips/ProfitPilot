import { describe, expect, it } from 'vitest';

import {
  buildLocalStorageKey,
  buildLocalStorageRecordTypePrefix,
  isProfitPilotLocalStorageKey,
  LOCAL_STORAGE_KEY_VERSION,
  LOCAL_STORAGE_NAMESPACE,
  recordIdFromLocalStorageKey,
} from '@/services/persistence/adapters/localStorageKeys';

/**
 * Centralized local storage keys — 06_TASKS.md M8-007 ("Define Local
 * Storage Keys"). DoD: "All keys use a consistent ProfitPilot namespace
 * and version convention."
 */
describe('local storage key scheme (M8-007)', () => {
  it('builds a namespaced, versioned key', () => {
    expect(buildLocalStorageKey('preferences', 'singleton')).toBe(
      `${LOCAL_STORAGE_NAMESPACE}:${LOCAL_STORAGE_KEY_VERSION}:preferences:singleton`,
    );
  });

  it('builds a record-type prefix ending in a trailing separator', () => {
    expect(buildLocalStorageRecordTypePrefix('portfolio')).toBe(
      `${LOCAL_STORAGE_NAMESPACE}:${LOCAL_STORAGE_KEY_VERSION}:portfolio:`,
    );
  });

  it('recovers the recordId from a key built for the same record type', () => {
    const key = buildLocalStorageKey('loopStrategy', 'strategy-1');
    expect(recordIdFromLocalStorageKey(key, 'loopStrategy')).toBe('strategy-1');
  });

  it('recognizes a key this application owns', () => {
    const key = buildLocalStorageKey('exitPlan', 'plan-1');
    expect(isProfitPilotLocalStorageKey(key)).toBe(true);
  });

  it('rejects a key belonging to an unrelated namespace', () => {
    expect(isProfitPilotLocalStorageKey('someOtherApp:v1:portfolio:p1')).toBe(false);
  });

  it('rejects a key with no namespace at all', () => {
    expect(isProfitPilotLocalStorageKey('random-string')).toBe(false);
  });

  it('every record type produces a distinct prefix, preventing cross-type collisions', () => {
    const portfolioPrefix = buildLocalStorageRecordTypePrefix('portfolio');
    const activePortfolioPrefix = buildLocalStorageRecordTypePrefix('activePortfolio');
    expect(portfolioPrefix).not.toBe(activePortfolioPrefix);
    expect(activePortfolioPrefix.startsWith(portfolioPrefix)).toBe(false);
  });
});
