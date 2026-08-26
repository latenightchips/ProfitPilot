/**
 * EIP-55 checksum-aware Ethereum address validation — V4 Readiness Audit
 * §12 P2-1. Replaces the plain-hex-shape-only check previously used by
 * `types/portfolio.schema.ts`'s `aaveV4PositionIdentitySchema` and
 * `scripts/verifyAaveV4Snapshot.ts`'s own independent copy of the same
 * pattern, per this stage's "reuse the validator consistently across
 * relevant manual address-entry paths" requirement.
 *
 * Built on `viem` (already an installed dependency — no new package added
 * solely for this). `viem`'s own `isAddress(address, { strict: true })`
 * (its default) is stricter than EIP-55 itself: EIP-55 only requires a
 * checksum match for addresses that mix upper- and lower-case hex digits,
 * treating an all-lowercase or all-uppercase address as carrying no
 * checksum information at all and therefore always valid — but `viem`
 * rejects all-uppercase input under both its default and explicit
 * `strict: true` modes (verified directly against the installed
 * `viem@2.55.15`). `strict: false` drops checksum validation entirely,
 * accepting a mixed-case address with the *wrong* checksum. Neither mode
 * alone matches this stage's desired behavior, so this wraps `isAddress`
 * (format-only, `strict: false`) with an explicit fast path for the two
 * "no checksum encoded" cases, falling back to `getAddress`-based
 * checksum comparison only for genuinely mixed-case input.
 *
 * Zero address (`0x000...000`) is accepted — same as the pattern this
 * replaces (`EVM_ADDRESS_PATTERN`), which imposed no such restriction;
 * this stage's own instructions call for following existing product
 * policy here rather than changing it implicitly.
 */
import { getAddress, isAddress } from 'viem';

export function isValidEip55Address(address: string): boolean {
  if (!isAddress(address, { strict: false })) return false;
  const hex = address.slice(2);
  if (hex === hex.toLowerCase() || hex === hex.toUpperCase()) return true;
  return address === getAddress(address);
}
