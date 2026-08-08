/**
 * Observability — public entry point. 06_TASKS.md M9-049 ("Implement
 * Production Error Monitoring") and M9-050 ("Implement Structured
 * Diagnostic Logging"). See `./errorMonitoring.ts` and
 * `./diagnosticEvent.ts` for the full reasoning behind each export.
 */
export {
  buildDiagnosticEvent,
  type BuildDiagnosticEventInput,
  type DiagnosticContext,
  type DiagnosticEvent,
  type DiagnosticOutcome,
  logDiagnosticEvent,
} from './diagnosticEvent';
export {
  captureError,
  type ErrorMonitoringContext,
  initErrorMonitoring,
  isErrorMonitoringConfigured,
} from './errorMonitoring';
