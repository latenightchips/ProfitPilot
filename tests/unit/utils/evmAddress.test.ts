import { describe, expect, it } from 'vitest';

import { hasEvmAddressShape, isValidEip55Address } from '@/utils/evmAddress';

describe('isValidEip55Address (V4 Readiness Audit §12 P2-1)', () => {
  it('accepts a valid all-lowercase address', () => {
    expect(isValidEip55Address('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(true);
  });

  it('accepts a valid all-uppercase address', () => {
    expect(isValidEip55Address('0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045')).toBe(true);
  });

  it('accepts a valid checksummed mixed-case address', () => {
    expect(isValidEip55Address('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
  });

  it('rejects a mixed-case address with an incorrect checksum', () => {
    expect(isValidEip55Address('0xD8DA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
  });

  it('rejects a too-short address', () => {
    expect(isValidEip55Address('0x1234')).toBe(false);
  });

  it('rejects a non-hex address', () => {
    expect(isValidEip55Address('0xZZZZ6BF26964AF9D7EED9E03E53415D37AA96045')).toBe(false);
  });

  it('rejects an address missing the 0x prefix', () => {
    expect(isValidEip55Address('d8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(false);
  });

  it('accepts the zero address (existing product policy)', () => {
    expect(isValidEip55Address('0x0000000000000000000000000000000000000000'.slice(0, 42))).toBe(
      true,
    );
  });
});

/**
 * `hasEvmAddressShape` — V4 Readiness Audit §12 P3-2. Format only, always
 * `true` for a well-shaped address regardless of checksum correctness —
 * this is exactly what lets a caller tell "malformed" apart from "right
 * shape, wrong checksum" for messaging purposes.
 */
describe('hasEvmAddressShape (V4 Readiness Audit §12 P3-2)', () => {
  it('is true for a valid all-lowercase address', () => {
    expect(hasEvmAddressShape('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(true);
  });

  it('is true for a well-shaped mixed-case address with the WRONG checksum', () => {
    expect(hasEvmAddressShape('0xD8DA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
  });

  it('is false for a too-short address', () => {
    expect(hasEvmAddressShape('0x1234')).toBe(false);
  });

  it('is false for a non-hex address', () => {
    expect(hasEvmAddressShape('0xZZZZ6BF26964AF9D7EED9E03E53415D37AA96045')).toBe(false);
  });

  it('is false for an address missing the 0x prefix', () => {
    expect(hasEvmAddressShape('d8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(false);
  });
});
