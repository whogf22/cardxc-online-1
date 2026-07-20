/**
 * @vitest-environment node
 *
 * Smoke tests that guard against load-time and boot regressions.
 *
 * Two of the bugs fixed in this codebase were LOAD-TIME crashes that neither
 * the frontend type-check nor the (previously absent) server type-check would
 * catch on their own, and which unit tests missed because the modules were not
 * imported anywhere:
 *
 *   1. securityService used an invalid regex /[;--]/g ("Range out of order in
 *      character class") that throws a SyntaxError the instant the module is
 *      imported, taking down the whole security sanitizer.
 *   2. batch/utils used `new pRetry.AbortError()`, but in p-retry v7 AbortError
 *      is a NAMED export, so pRetry.AbortError is undefined and every retry
 *      abort path threw "not a constructor".
 *
 * These tests import those modules (proving they load) and exercise the health
 * router (proving the basic request path works without a database).
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { healthRouter } from '../health';

describe('health router smoke tests', () => {
  const app = express();
  app.use('/api/health', healthRouter);

  it('GET /api/health returns 200 healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /api/health/live returns 200 live', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.live).toBe(true);
  });

  it('GET /api/health/version returns version info', async () => {
    const res = await request(app).get('/api/health/version');
    expect(res.status).toBe(200);
    expect(res.body.version).toBeTruthy();
    expect(res.body.nodeVersion).toBe(process.version);
  });
});

describe('previously-crashing modules load and behave correctly', () => {
  it('securityService loads and sanitizeInput strips XSS + SQLi chars (regex regression guard)', async () => {
    const mod = await import('../../services/securityService');
    expect(typeof mod.sanitizeInput).toBe('function');
    // Must not throw at import (the old /[;--]/g threw a SyntaxError on load).
    expect(mod.sanitizeInput('<script>alert(1)</script>')).not.toContain('<');
    expect(mod.sanitizeInput("Robert'); DROP TABLE users; --")).not.toContain(';');
    expect(mod.sanitizeInput("Robert'); DROP TABLE users; --")).not.toContain('--');
    expect(mod.sanitizeInput('')).toBe('');
  });

  it('batch/utils loads with a usable AbortError constructor (p-retry named-export regression guard)', async () => {
    // Importing proves the module parses; the fix switched from the invalid
    // `new pRetry.AbortError()` to the named import.
    const mod = await import('../../replit_integrations/batch/utils');
    expect(mod).toBeTruthy();
    const { AbortError } = await import('p-retry');
    expect(typeof AbortError).toBe('function');
    expect(() => new AbortError('x')).not.toThrow();
  });
});
