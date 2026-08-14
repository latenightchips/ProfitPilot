import { describe, expect, it } from 'vitest';

import { getAaveAdapter } from '@/infrastructure/protocols/aave';

describe('getAaveAdapter — version selector', () => {
  it('returns a v3 adapter for version "v3"', () => {
    const adapter = getAaveAdapter({ version: 'v3', rpcUrl: 'https://example.invalid' });
    expect(adapter.version).toBe('v3');
    expect(typeof adapter.fetchReserveSnapshot).toBe('function');
  });

  it('throws for an unsupported version rather than silently falling back', () => {
    expect(() =>
      getAaveAdapter({ version: 'v4' as unknown as 'v3', rpcUrl: 'https://example.invalid' }),
    ).toThrow(/Unsupported Aave protocol version/);
  });
});
