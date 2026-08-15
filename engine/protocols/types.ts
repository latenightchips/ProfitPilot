/**
 * Protocol/version identity for `engine/protocols/`'s protocol-specific
 * modules (`./aaveV3`, `./aaveV4`) — V4 Readiness Audit §12 Stage 1
 * ("protocol-boundary scaffolding only").
 *
 * ProfitPilot v0.1 is Aave-only (01_PRD.md REQ-003), so no `protocol`
 * discriminant exists yet — adding one now (e.g. `{ protocol: 'aave' }`)
 * would invent multi-protocol generality nothing in scope asks for yet.
 * `AaveProtocolVersion` alone is the smallest safe representation: `'v3'`
 * (implemented, unchanged — the authoritative direct-RPC-parity math) and
 * `'v4'` (typed, explicitly unsupported — see `./aaveV4`, which fails
 * closed on every call rather than approximating with V3's math).
 *
 * Deliberately NOT the same type as `infrastructure/protocols/aave/types.ts`'s
 * own `AaveProtocolVersion` (currently `'v3'` only) — same name, same
 * real-world concept, but a distinct type in a distinct layer. The Engine
 * has zero external dependencies by design (`engine/index.ts`'s own header
 * comment), so it cannot import Infrastructure's type; duplicating the
 * name here is intentional, not an oversight.
 */
export type AaveProtocolVersion = 'v3' | 'v4';
