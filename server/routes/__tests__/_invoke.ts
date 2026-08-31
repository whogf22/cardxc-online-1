/**
 * In-process Express Router driver for unit tests.
 *
 * The sandbox this suite runs in forbids listen() (EPERM on any bind), so
 * supertest-based tests cannot run here. This helper dispatches a request
 * straight through an Express Router without opening a socket. It implements
 * just enough of the req/res contract for JSON API handlers that use
 * res.status().json() and propagate AppError via next(err).
 *
 * NOTE: this is a test utility, not application code. The filename has no
 * .test/.spec suffix so vitest does not collect it as a suite.
 */
import type { Router } from 'express';

export interface InvokeResult {
  status: number;
  body: any;
}

export interface InvokeOptions {
  body?: any;
  /** Raw request body, for handlers that verify webhook signatures. */
  rawBody?: Buffer;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  user?: any;
}

export function invokeRouter(
  router: Router,
  method: string,
  url: string,
  opts: InvokeOptions = {},
): Promise<InvokeResult> {
  return new Promise((resolve, reject) => {
    const path = url.split('?')[0];
    const req: any = {
      method: method.toUpperCase(),
      url,
      originalUrl: url,
      baseUrl: '',
      path,
      headers: opts.headers ?? {},
      body: opts.body ?? {},
      query: opts.query ?? {},
      params: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
    };
    if (opts.user !== undefined) req.user = opts.user;
    if (opts.rawBody !== undefined) req.rawBody = opts.rawBody;

    let settled = false;
    const done = (status: number, body: any) => {
      if (settled) return;
      settled = true;
      resolve({ status, body });
    };

    const res: any = {
      statusCode: 200,
      headersSent: false,
      locals: {},
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      set() {
        return this;
      },
      setHeader() {
        return this;
      },
      getHeader() {
        return undefined;
      },
      json(payload: any) {
        this.headersSent = true;
        done(this.statusCode, payload);
        return this;
      },
      send(payload: any) {
        this.headersSent = true;
        done(this.statusCode, payload);
        return this;
      },
      end() {
        this.headersSent = true;
        done(this.statusCode, undefined);
        return this;
      },
    };
    req.res = res;
    res.req = req;

    // Mirror the application's AppError-shaped error handler.
    const next = (err?: any) => {
      if (err) {
        const status = err.statusCode || 500;
        done(status, { success: false, error: { message: err.message, code: err.code } });
      } else {
        done(404, { success: false, error: { message: 'Not Found' } });
      }
    };

    try {
      (router as unknown as (req: any, res: any, next: any) => void)(req, res, next);
    } catch (e) {
      reject(e);
    }
  });
}
