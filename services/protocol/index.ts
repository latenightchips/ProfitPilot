/**
 * Protocol Parameter Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-008 ("Implement Protocol Parameter Service") is its
 * first occupant.
 */
export {
  normalizeProtocolQuote,
  type NormalizeProtocolQuoteInput,
  type ProtocolOrigin,
  type ProtocolQuote,
  type ProtocolQuoteAvailable,
  type ProtocolQuoteUnavailable,
  type RawProtocolCandidate,
} from './quote';
