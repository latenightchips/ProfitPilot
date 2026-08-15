/**
 * Aave V4 Live Position Service — public entry point.
 *
 * V4 Readiness Audit §12 Stage 4B established this directory —
 * `services/protocol` (M3-008) already owns the distinct "Protocol
 * Parameter Service" concept (normalizing candidate LTV/rate quotes),
 * so this Aave-V4-specific identity-validation Service gets its own
 * directory rather than being folded into that one.
 */
export {
  type AaveV4AdapterFailureInput,
  type AaveV4LivePositionRequest,
  mapAaveV4AdapterFailure,
  validateAaveV4LivePositionRequest,
  type ValidatedAaveV4LivePositionRequest,
} from './v4LivePosition';
