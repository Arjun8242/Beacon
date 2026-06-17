import { describe, it, expect } from 'vitest';
import { determineStatus, slugify, calculateUptimePercent, getWindowStart, CheckStatus } from '../../packages/shared/src/index';

describe('determineStatus', () => {
  it('should return DOWN if error is provided', () => {
    expect(determineStatus(200, new Error('Network error'))).toBe(CheckStatus.DOWN);
  });

  it('should return DOWN if statusCode is undefined or null', () => {
    expect(determineStatus()).toBe(CheckStatus.DOWN);
  });

  it('should return DOWN if statusCode is >= 500', () => {
    expect(determineStatus(500)).toBe(CheckStatus.DOWN);
    expect(determineStatus(503)).toBe(CheckStatus.DOWN);
  });

  it('should return DEGRADED if statusCode is between 400 and 499', () => {
    expect(determineStatus(400)).toBe(CheckStatus.DEGRADED);
    expect(determineStatus(404)).toBe(CheckStatus.DEGRADED);
    expect(determineStatus(499)).toBe(CheckStatus.DEGRADED);
  });

  it('should return DEGRADED if responseTime > 5000', () => {
    expect(determineStatus(200, undefined, 5001)).toBe(CheckStatus.DEGRADED);
    expect(determineStatus(200, undefined, 10000)).toBe(CheckStatus.DEGRADED);
  });

  it('should return UP if responseTime <= 5000', () => {
    expect(determineStatus(200, undefined, 5000)).toBe(CheckStatus.UP);
    expect(determineStatus(200, undefined, 200)).toBe(CheckStatus.UP);
  });

  it('should return UP if statusCode is between 100 and 399', () => {
    expect(determineStatus(200)).toBe(CheckStatus.UP);
    expect(determineStatus(201)).toBe(CheckStatus.UP);
    expect(determineStatus(301)).toBe(CheckStatus.UP);
    expect(determineStatus(302)).toBe(CheckStatus.UP);
  });
});

describe('slugify', () => {
  it('should convert name to lowercase', () => {
    const res = slugify('GoogleSearch');
    expect(res).toMatch(/^googlesearch-[a-z0-9]{4}$/);
  });

  it('should replace non-alphanumeric characters with hyphens', () => {
    const res = slugify('Google Search!!! 123');
    expect(res).toMatch(/^google-search-123-[a-z0-9]{4}$/);
  });

  it('should trim leading and trailing hyphens', () => {
    const res = slugify('---My Cool Page---');
    expect(res).toMatch(/^my-cool-page-[a-z0-9]{4}$/);
  });

  it('should return unique slugs for the same base name due to random suffix', () => {
    const res1 = slugify('test');
    const res2 = slugify('test');
    expect(res1).not.toBe(res2);
    expect(res1).toMatch(/^test-[a-z0-9]{4}$/);
    expect(res2).toMatch(/^test-[a-z0-9]{4}$/);
  });
});

describe('calculateUptimePercent', () => {
  it('should return 100 if totalCount is 0', () => {
    expect(calculateUptimePercent(0, 0)).toBe(100);
    expect(calculateUptimePercent(5, 0)).toBe(100);
  });

  it('should return 100 if upCount equals totalCount', () => {
    expect(calculateUptimePercent(100, 100)).toBe(100);
  });

  it('should return 0 if upCount is 0 and totalCount > 0', () => {
    expect(calculateUptimePercent(0, 10)).toBe(0);
  });

  it('should calculate accurate percentage', () => {
    expect(calculateUptimePercent(95, 100)).toBe(95);
    expect(calculateUptimePercent(99, 100)).toBe(99);
  });

  it('should round to 2 decimal places', () => {
    // 2 / 3 is 66.6666... %
    expect(calculateUptimePercent(2, 3)).toBe(66.67);
    // 1 / 3 is 33.3333... %
    expect(calculateUptimePercent(1, 3)).toBe(33.33);
  });
});

describe('getWindowStart', () => {
  it('should return a date 24 hours ago for "24h"', () => {
    const start = getWindowStart('24h');
    const diffMs = Date.now() - start.getTime();
    // Around 24 hours (86400000 ms) - allowing some delta
    expect(diffMs).toBeGreaterThanOrEqual(86400000 - 10000);
    expect(diffMs).toBeLessThanOrEqual(86400000 + 10000);
  });

  it('should return a date 7 days ago for "7d"', () => {
    const start = getWindowStart('7d');
    const diffMs = Date.now() - start.getTime();
    const expected = 7 * 24 * 60 * 60 * 1000;
    expect(diffMs).toBeGreaterThanOrEqual(expected - 10000);
    expect(diffMs).toBeLessThanOrEqual(expected + 10000);
  });

  it('should return a date 30 days ago for "30d"', () => {
    const start = getWindowStart('30d');
    const diffMs = Date.now() - start.getTime();
    const expected = 30 * 24 * 60 * 60 * 1000;
    expect(diffMs).toBeGreaterThanOrEqual(expected - 10000);
    expect(diffMs).toBeLessThanOrEqual(expected + 10000);
  });
});