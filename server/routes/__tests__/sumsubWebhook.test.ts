/**
 * @vitest-environment node
 */
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { beforeAll, afterEach, vi, describe, it, expect } from 'vitest';

const mockQueryOne = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockWebhookLimiter = vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next());

vi.mock('../../db/pool', () => ({
  query: () => Promise.resolve([]),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));
vi.mock('../../middleware/rateLimit', () => ({
  webhookLimiter: mockWebhookLimiter,
}));

let app: express.Express;

function signPayload(payload: object, secret: string, algorithm = 'sha256'): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  return crypto.createHmac(algorithm, secret).update(body).digest('hex');
}

beforeAll(async () => {
  process.env.SUMSUB_APP_TOKEN = 'test';
  process.env.SUMSUB_SECRET_KEY = 'test';
  process.env.SUMSUB_LEVEL_NAME = 'basic-kyc-level';
  process.env.SUMSUB_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.SUMSUB_ENABLED = 'true';

  vi.resetModules();
  const { sumsubWebhookRouter } = await import('../sumsubWebhooks');

  app = express();
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.originalUrl?.split('?')[0] === '/api/webhooks/sumsub') {
      return express.raw({ type: 'application/json', limit: '100kb' })(req, res, (err: Error) => {
        if (err) return next(err);
        next();
      });
    }
    next();
  });
  app.use('/api/webhooks', sumsubWebhookRouter);
});

afterEach(() => {
  mockQueryOne.mockReset();
  mockCreateAuditLog.mockReset();
});

describe('Sumsub webhook handler', () => {
  const basePayload = {
    type: 'applicantReviewed',
    applicantId: 'app-1',
    externalUserId: 'user-1',
    inspectionId: 'insp-1',
  };

  it('returns 401 when signature is missing', async () => {
    const res = await request(app)
      .post('/api/webhooks/sumsub')
      .set('Content-Type', 'application/json')
      .send(basePayload);
    expect(res.status).toBe(401);
  });

  it('returns 401 when signature is invalid', async () => {
    const res = await request(app)
      .post('/api/webhooks/sumsub')
      .set('Content-Type', 'application/json')
      .set('x-payload-digest', 'invalid')
      .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
      .send(basePayload);
    expect(res.status).toBe(401);
  });

  describe('identity resolution', () => {
    it('updates user A when externalUserId and applicantId both belong to user A', async () => {
      const payload = { ...basePayload, reviewResult: { reviewAnswer: 'GREEN' } };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'pending', sumsub_applicant_id: 'app-1' }) // resolve by externalUserId
        .mockResolvedValueOnce({ id: 'user-1' }); // CTE update succeeded

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const userLookup = mockQueryOne.mock.calls.find((call) =>
        (call[0] as string).includes('SELECT id, kyc_status, sumsub_applicant_id FROM users WHERE id = $1')
      );
      expect(userLookup).toBeTruthy();
      expect(userLookup?.[1]).toEqual(['user-1']);

      const cteCall = mockQueryOne.mock.calls.find((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCall).toBeTruthy();
      expect(cteCall?.[1]).toEqual(expect.arrayContaining(['approved', 'app-1', 'insp-1', 'user-1']));
    });

    it('does not update any user when externalUserId maps to user A but applicantId belongs to user B', async () => {
      const payload = { ...basePayload, reviewResult: { reviewAnswer: 'GREEN' } };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'pending', sumsub_applicant_id: 'app-2' }); // applicantId mismatch

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCalls = mockQueryOne.mock.calls.filter((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCalls).toHaveLength(0);
    });

    it('does not fall back to another user when externalUserId is supplied but missing', async () => {
      const payload = {
        ...basePayload,
        externalUserId: 'missing-user',
        reviewResult: { reviewAnswer: 'GREEN' },
      };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce(null); // externalUserId not found

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const applicantLookup = mockQueryOne.mock.calls.find((call) =>
        (call[0] as string).includes('FROM users WHERE sumsub_applicant_id = $1')
      );
      expect(applicantLookup).toBeFalsy();

      const cteCalls = mockQueryOne.mock.calls.filter((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCalls).toHaveLength(0);
    });

    it('binds applicantId on first webhook when user has no mapping and no other user owns it', async () => {
      const payload = { ...basePayload, reviewResult: { reviewAnswer: 'GREEN' } };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'not_started', sumsub_applicant_id: null }) // resolve by externalUserId
        .mockResolvedValueOnce(null) // conflict check: no other user owns app-1
        .mockResolvedValueOnce({ id: 'user-1' }); // CTE update succeeded

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCall = mockQueryOne.mock.calls.find((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCall).toBeTruthy();
      expect(cteCall?.[1]).toEqual(expect.arrayContaining(['approved', 'app-1', 'insp-1', 'user-1']));
    });

    it('does not rebind applicantId when user already has a different mapping', async () => {
      const payload = { ...basePayload, reviewResult: { reviewAnswer: 'GREEN' } };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'pending', sumsub_applicant_id: 'app-old' }); // existing mapping

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCalls = mockQueryOne.mock.calls.filter((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCalls).toHaveLength(0);
    });

    it('does not bind applicantId when another user already owns it', async () => {
      const payload = { ...basePayload, reviewResult: { reviewAnswer: 'GREEN' } };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'not_started', sumsub_applicant_id: null }) // resolve by externalUserId
        .mockResolvedValueOnce({ id: 'user-2' }); // conflict check: app-1 belongs to user-2

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCalls = mockQueryOne.mock.calls.filter((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCalls).toHaveLength(0);
    });

    it('resolves by applicantId when externalUserId is absent', async () => {
      const payload = { type: 'applicantPending', applicantId: 'app-1', inspectionId: 'insp-1' };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-2', kyc_status: 'not_started', sumsub_applicant_id: 'app-1' }) // resolve by applicantId
        .mockResolvedValueOnce({ id: 'user-2' }); // CTE update succeeded

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const userLookup = mockQueryOne.mock.calls.find((call) =>
        (call[0] as string).includes('SELECT id, kyc_status, sumsub_applicant_id FROM users WHERE sumsub_applicant_id = $1')
      );
      expect(userLookup).toBeTruthy();
      expect(userLookup?.[1]).toEqual(['app-1']);
    });

    it('skips duplicate events with the same dedupe key', async () => {
      const payload = { ...basePayload, reviewResult: { reviewAnswer: 'GREEN' } };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'pending', sumsub_applicant_id: 'app-1' }) // resolve by externalUserId
        .mockResolvedValueOnce({ id: 'user-1' }); // CTE update succeeded

      await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload)
        .expect(200);

      const cteCall = mockQueryOne.mock.calls.find((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCall).toBeTruthy();
      const dedupeKey = (cteCall?.[1] as unknown[])[4];

      // Second identical delivery: the dedupe check now sees an existing event.
      mockQueryOne.mockReset();
      mockQueryOne.mockResolvedValueOnce({ id: 'event-1' }); // dedupe exists

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);
      expect(mockQueryOne).toHaveBeenLastCalledWith(
        'SELECT id FROM sumsub_webhook_events WHERE dedupe_key = $1',
        [dedupeKey]
      );
      const cteCalls = mockQueryOne.mock.calls.filter((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCalls).toHaveLength(0);
    });
  });

  describe('lifecycle event mapping', () => {
    it('applicantCreated does not move a not_started user to pending', async () => {
      const payload = {
        type: 'applicantCreated',
        applicantId: 'app-1',
        externalUserId: 'user-1',
        inspectionId: 'insp-1',
      };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne.mockResolvedValueOnce(null); // dedupe check

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCalls = mockQueryOne.mock.calls.filter((call) =>
        (call[0] as string).includes('WITH inserted AS')
      );
      expect(cteCalls).toHaveLength(0);
    });

    it('applicantPending transitions a not_started user to pending', async () => {
      const payload = { type: 'applicantPending', applicantId: 'app-1', externalUserId: 'user-1', inspectionId: 'insp-1' };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'not_started', sumsub_applicant_id: null }) // resolve by externalUserId
        .mockResolvedValueOnce(null) // conflict check: no other user owns app-1
        .mockResolvedValueOnce({ id: 'user-1' }); // CTE update succeeded

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCall = mockQueryOne.mock.calls.find((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCall).toBeTruthy();
      expect(cteCall?.[1]).toEqual(expect.arrayContaining(['pending', 'app-1', 'insp-1', 'user-1']));
    });

    it('applicantOnHold keeps the user under review (pending)', async () => {
      const payload = { type: 'applicantOnHold', applicantId: 'app-1', externalUserId: 'user-1', inspectionId: 'insp-1' };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'pending', sumsub_applicant_id: 'app-1' }) // resolve by externalUserId
        .mockResolvedValueOnce({ id: 'user-1' }); // CTE update succeeded

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCall = mockQueryOne.mock.calls.find((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCall).toBeTruthy();
      expect(cteCall?.[1]).toEqual(expect.arrayContaining(['pending', 'app-1', 'insp-1', 'user-1']));
    });
  });

  describe('review outcome mapping', () => {
    it('updates user to approved on GREEN review', async () => {
      const payload = { ...basePayload, reviewResult: { reviewAnswer: 'GREEN' } };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'pending', sumsub_applicant_id: 'app-1' })
        .mockResolvedValueOnce({ id: 'user-1' });

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCall = mockQueryOne.mock.calls.find((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCall).toBeTruthy();
      expect(cteCall?.[1]).toEqual(expect.arrayContaining(['approved', 'app-1', 'insp-1', 'user-1']));
    });

    it('updates user to rejected on RED review and records reject type', async () => {
      const payload = {
        ...basePayload,
        reviewResult: {
          reviewAnswer: 'RED',
          reviewRejectType: 'FINAL',
          rejectLabels: ['GRAPHIC_EDITOR', 'FORGERY'],
        },
      };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'pending', sumsub_applicant_id: 'app-1' })
        .mockResolvedValueOnce({ id: 'user-1' });

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCall = mockQueryOne.mock.calls.find((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCall).toBeTruthy();
      expect(cteCall?.[1]).toEqual(expect.arrayContaining(['rejected', 'FINAL: GRAPHIC_EDITOR, FORGERY']));
    });

    it('records RETRY reject type so the user can request another token', async () => {
      const payload = {
        ...basePayload,
        reviewResult: {
          reviewAnswer: 'RED',
          reviewRejectType: 'RETRY',
          rejectLabels: ['GRAPHIC_EDITOR'],
        },
      };
      const signature = signPayload(payload, process.env.SUMSUB_WEBHOOK_SECRET as string);

      mockQueryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-1', kyc_status: 'pending', sumsub_applicant_id: 'app-1' })
        .mockResolvedValueOnce({ id: 'user-1' });

      const res = await request(app)
        .post('/api/webhooks/sumsub')
        .set('Content-Type', 'application/json')
        .set('x-payload-digest', signature)
        .set('x-payload-digest-alg', 'HMAC_SHA256_HEX')
        .send(payload);

      expect(res.status).toBe(200);

      const cteCall = mockQueryOne.mock.calls.find((call) => (call[0] as string).includes('WITH inserted AS'));
      expect(cteCall).toBeTruthy();
      expect(cteCall?.[1]).toEqual(expect.arrayContaining(['rejected', 'RETRY: GRAPHIC_EDITOR']));
    });
  });
});
