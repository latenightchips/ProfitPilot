/**
 * Fixed-window in-memory rate limiter — R1-2 ("Protect Aave API Boundary +
 * Least-Privilege CI"). Generic and protocol-agnostic on purpose: this
 * file knows nothing about Aave, Next.js, or HTTP — it is a small, pure,
 * directly-testable counter, kept separate from `./aaveApiRateLimit.ts`
 * (the module that actually decides Aave-specific policy: the limit,
 * the window, client identity, and the HTTP response shape) so each half
 * can be tested in complete isolation.
 *
 * **Fixed window, not sliding window or token bucket, deliberately.** A
 * fixed window has one well-understood tradeoff — a client can send up
 * to `limit` requests right at the end of one window and another `limit`
 * right at the start of the next, briefly doubling the effective rate at
 * the boundary. That tradeoff is accepted here in exchange for a
 * counter simple enough to reason about, test, and audit — R1-2's own
 * brief explicitly asks for "the smallest production-safe rate-limit
 * boundary," not a general-purpose rate-limiting framework.
 *
 * **Deterministic by construction.** `now` is an injectable clock
 * (`Date.now` by default) rather than read internally — every test in
 * `tests/unit/services/rateLimit/fixedWindowRateLimiter.test.ts` drives
 * this with a manually-advanced fake clock, never a real timer/sleep.
 *
 * **In-memory only — process-local, not distributed.** This class holds
 * its state in a plain `Map`, scoped to whatever single process/isolate
 * constructs it. It provides zero cross-instance consistency: two
 * concurrently running instances (two serverless invocations, two edge
 * isolates in different regions, two replicas behind a load balancer)
 * each enforce the configured limit independently, so the *effective*
 * ceiling across a horizontally-scaled deployment is `limit × (number of
 * live instances)`, not `limit`. See `./aaveApiRateLimit.ts`'s own
 * header comment for the full, honest accounting of what this does and
 * does not protect against, and `docs/OPERATIONAL_RUNBOOK.md`'s
 * "Aave API rate limiting" section for the deployment-level
 * recommendation this does not attempt to replace.
 *
 * **Unbounded key growth, bounded by opportunistic sweeping.** A naive
 * `Map` that only ever grows would leak memory over a long-running
 * process as new client identities appear. `consume` opportunistically
 * sweeps stale entries (older than two full windows) every
 * `SWEEP_INTERVAL_REQUESTS` calls — cheap, deterministic (driven by call
 * count, not a background timer this test suite would otherwise have to
 * fake), and good enough for this limiter's own bounded key space (a
 * handful of client identities in the common case, never unbounded
 * unless already under sustained abuse from many distinct identities —
 * exactly the scenario this limiter exists to blunt in the first place).
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window after this call. 0 when `allowed` is false. */
  remaining: number;
  /** Seconds until the caller may retry. Always 0 when `allowed` is true, always ≥ 1 when false. */
  retryAfterSeconds: number;
}

export interface FixedWindowRateLimiterOptions {
  /** Maximum requests permitted per key within one window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock — defaults to `Date.now`. Tests supply a fake, manually-advanced clock instead. */
  now?: () => number;
}

interface WindowState {
  count: number;
  windowStart: number;
}

const SWEEP_INTERVAL_REQUESTS = 500;
/** Retain a stale entry for two full windows past its start before sweeping — comfortably past the point it could still matter to an in-flight window check. */
const SWEEP_RETENTION_WINDOWS = 2;

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, WindowState>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private requestsSinceSweep = 0;

  constructor({ limit, windowMs, now = Date.now }: FixedWindowRateLimiterOptions) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** Records one request for `key` and reports whether it is within the limit. */
  consume(key: string): RateLimitResult {
    const nowMs = this.now();
    this.maybeSweep(nowMs);

    const existing = this.buckets.get(key);
    if (existing === undefined || nowMs - existing.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: nowMs });
      return { allowed: true, remaining: this.limit - 1, retryAfterSeconds: 0 };
    }

    if (existing.count >= this.limit) {
      const windowEndsAt = existing.windowStart + this.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((windowEndsAt - nowMs) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    existing.count += 1;
    return { allowed: true, remaining: this.limit - existing.count, retryAfterSeconds: 0 };
  }

  private maybeSweep(nowMs: number): void {
    this.requestsSinceSweep += 1;
    if (this.requestsSinceSweep < SWEEP_INTERVAL_REQUESTS) return;
    this.requestsSinceSweep = 0;

    const staleBefore = nowMs - this.windowMs * SWEEP_RETENTION_WINDOWS;
    for (const [key, entry] of this.buckets) {
      if (entry.windowStart < staleBefore) this.buckets.delete(key);
    }
  }
}
