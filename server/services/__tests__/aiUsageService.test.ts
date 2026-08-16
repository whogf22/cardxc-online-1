/**
 * @vitest-environment node
 *
 * Daily-limit configuration parsing for the AI assistant budget.
 *
 * The budget's behavioural coverage (atomic reservation, concurrency ceiling,
 * fail-closed paths, limit-0 disable) lives in `aiUsageConcurrency.test.ts`.
 * This file covers only how the configured limit is parsed, which is where a
 * subtle operator-facing bug lived: `Number(x) || 100` silently turned an
 * intentional `AI_DAILY_MESSAGE_LIMIT=0` ("disable the assistant") into the
 * default allowance of 100.
 */
import { describe, it, expect } from 'vitest';

import { __resolveDailyLimitForTests, getAiDailyMessageLimit } from '../aiUsageService';

describe('daily limit configuration', () => {
  it('defaults to 100 when unset or blank', () => {
    expect(__resolveDailyLimitForTests(undefined)).toBe(100);
    expect(__resolveDailyLimitForTests('')).toBe(100);
    expect(__resolveDailyLimitForTests('   ')).toBe(100);
  });

  it('honours an explicit 0 as a hard stop, not the default', () => {
    expect(__resolveDailyLimitForTests('0')).toBe(0);
  });

  it('honours a normal override', () => {
    expect(__resolveDailyLimitForTests('25')).toBe(25);
  });

  it('falls back to the default on a non-numeric value', () => {
    expect(__resolveDailyLimitForTests('abc')).toBe(100);
    expect(__resolveDailyLimitForTests('NaN')).toBe(100);
  });

  it('falls back to the default on a negative value', () => {
    expect(__resolveDailyLimitForTests('-5')).toBe(100);
  });

  it('reads the environment at call time, not module load', () => {
    // Mirrors the convention in services/fulfillmentPolicy.ts. Reading at call
    // time is what makes the value testable and per-environment togglable.
    const original = process.env.AI_DAILY_MESSAGE_LIMIT;
    try {
      process.env.AI_DAILY_MESSAGE_LIMIT = '7';
      expect(getAiDailyMessageLimit()).toBe(7);
      process.env.AI_DAILY_MESSAGE_LIMIT = '0';
      expect(getAiDailyMessageLimit()).toBe(0);
    } finally {
      if (original === undefined) delete process.env.AI_DAILY_MESSAGE_LIMIT;
      else process.env.AI_DAILY_MESSAGE_LIMIT = original;
    }
  });
});
