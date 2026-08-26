import { describe, expect, it } from 'vitest';

import { FixedWindowRateLimiter } from '@/services/rateLimit/fixedWindowRateLimiter';

/**
 * `FixedWindowRateLimiter` — R1-2. Every test drives time via a manually
 * advanced fake clock (`currentTime`), never a real timer or `sleep` —
 * the limiter's own `now` option exists specifically so this is possible
 * deterministically.
 */
function fakeClock(startAt = 0): { now: () => number; advance: (ms: number) => void } {
  let currentTime = startAt;
  return {
    now: () => currentTime,
    advance: (ms: number) => {
      currentTime += ms;
    },
  };
}

describe('FixedWindowRateLimiter', () => {
  it('allows every request up to the configured limit', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 3, windowMs: 1000, now: clock.now });

    expect(limiter.consume('client-a')).toMatchObject({ allowed: true, remaining: 2 });
    expect(limiter.consume('client-a')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('client-a')).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('blocks the request that exceeds the limit within the same window', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 1000, now: clock.now });

    limiter.consume('client-a');
    limiter.consume('client-a');
    const blocked = limiter.consume('client-a');

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('reports a positive, valid retryAfterSeconds when blocked', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 10_000, now: clock.now });

    limiter.consume('client-a');
    clock.advance(3_000);
    const blocked = limiter.consume('client-a');

    expect(blocked.allowed).toBe(false);
    // 10s window, 3s elapsed → 7s remain until reset.
    expect(blocked.retryAfterSeconds).toBe(7);
  });

  it('never reports retryAfterSeconds below 1, even at the very edge of the window', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });

    limiter.consume('client-a');
    clock.advance(999);
    const blocked = limiter.consume('client-a');

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('resets and allows requests again once the window has fully elapsed — fake time, no real sleep', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });

    expect(limiter.consume('client-a').allowed).toBe(true);
    expect(limiter.consume('client-a').allowed).toBe(false);

    clock.advance(1000);

    const afterReset = limiter.consume('client-a');
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });

  it('tracks independent keys with independent allowances', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });

    expect(limiter.consume('client-a').allowed).toBe(true);
    expect(limiter.consume('client-a').allowed).toBe(false);

    // A different key has its own, untouched budget.
    expect(limiter.consume('client-b').allowed).toBe(true);
  });
});
