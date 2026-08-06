import { describe, expect, it } from 'vitest';

import { generateDeviceId } from '@/utils/deviceId';

describe('generateDeviceId', () => {
  it('returns a well-formed UUID', () => {
    const id = generateDeviceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('returns a different value on each call', () => {
    const a = generateDeviceId();
    const b = generateDeviceId();
    expect(a).not.toBe(b);
  });
});
