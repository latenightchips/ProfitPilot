import { describe, expect, it } from 'vitest';

import { createFailure, createSuccess } from '@/engine/shared/result';
import packageJson from '@/package.json';

const baseOptions = {
  formulaId: 'F-001',
  formulaVersion: '1.0',
  inputsUsed: { amount: 1 },
};

describe('createSuccess', () => {
  it('wraps a value with metadata and empty warnings by default', () => {
    const result = createSuccess(100, baseOptions);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(100);
    expect(result.warnings).toEqual([]);
    expect(result.metadata.formulaId).toBe('F-001');
    expect(result.metadata.formulaVersion).toBe('1.0');
    expect(result.metadata.inputsUsed).toEqual({ amount: 1 });
    expect(result.metadata.assumptions).toEqual([]);
    expect(typeof result.metadata.engineVersion).toBe('string');
    expect(() => new Date(result.metadata.timestamp)).not.toThrow();
  });

  it('keeps its hardcoded ENGINE_VERSION in sync with package.json', () => {
    // engine/shared/result.ts intentionally hardcodes ENGINE_VERSION instead
    // of importing package.json, so the Engine has no dependency on the host
    // application (see this session's framework-independence review). This
    // test is the drift guard that hardcoding trades away.
    const result = createSuccess(100, baseOptions);
    expect(result.metadata.engineVersion).toBe(packageJson.version);
  });

  it('carries provided warnings and assumptions', () => {
    const result = createSuccess(100, { ...baseOptions, assumptions: ['Constant BTC price'] }, [
      { code: 'W-1', message: 'example warning' },
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.metadata.assumptions).toEqual(['Constant BTC price']);
  });
});

describe('createFailure', () => {
  it('wraps an error with metadata', () => {
    const result = createFailure({ code: 'INVALID_FINITE', message: 'bad input' }, baseOptions);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_FINITE');
    expect(result.metadata.formulaId).toBe('F-001');
  });
});
