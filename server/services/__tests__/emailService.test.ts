/**
 * @vitest-environment node
 *
 * Characterization + regression suite for the SMTP layer.
 *
 * Written to pin behaviour ACROSS the nodemailer 8 -> 9 security upgrade
 * (GHSA: message-level `raw` bypassing disableFileAccess/disableUrlAccess).
 * The contract asserted here — transporter construction, OTP/verification
 * delivery, auth/config gating, and the error path — must be identical before
 * and after the upgrade.
 *
 * It also pins the security-relevant property that our senders never pass the
 * vulnerable `raw` option and never enable remote content loading.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

interface TransportOptions {
  host?: string; port?: number; secure?: boolean; requireTLS?: boolean;
  tls?: { rejectUnauthorized?: boolean; minVersion?: string };
  auth?: { user: string; pass: string };
}

const sendMailMock = vi.fn();
const verifyMock = vi.fn();
const createTransportMock = vi.fn((_opts: TransportOptions) => ({ sendMail: sendMailMock, verify: verifyMock }));

vi.mock('nodemailer', () => ({
  default: { createTransport: (opts: TransportOptions) => createTransportMock(opts) },
  createTransport: (opts: TransportOptions) => createTransportMock(opts),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  sendMailMock.mockReset().mockResolvedValue({ messageId: 'msg-1' });
  verifyMock.mockReset().mockResolvedValue(true);
  createTransportMock.mockClear();
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'noreply@example.test';
  process.env.SMTP_PASS = 'app-password';
  process.env.SMTP_FROM = 'CardXC <noreply@example.test>';
});
afterEach(() => {
  process.env = { ...ENV };
});

describe('transporter creation', () => {
  it('builds the transport from SMTP_* config with TLS floor of 1.2', async () => {
    await import('../emailService');
    expect(createTransportMock).toHaveBeenCalled();
    const opts = createTransportMock.mock.calls[0]![0];
    expect(opts.host).toBe('smtp.example.test');
    expect(opts.port).toBe(587);
    expect(opts.tls.minVersion).toBe('TLSv1.2');
    expect(opts.auth).toEqual({ user: 'noreply@example.test', pass: 'app-password' });
  });

  it('requires STARTTLS on port 587 (non-secure)', async () => {
    await import('../emailService');
    const opts = createTransportMock.mock.calls[0]![0];
    expect(opts.secure).toBe(false);
    expect(opts.requireTLS).toBe(true);
  });

  it('uses implicit TLS on port 465', async () => {
    process.env.SMTP_PORT = '465';
    await import('../emailService');
    const opts = createTransportMock.mock.calls[0]![0];
    expect(opts.secure).toBe(true);
  });

  it('trims whitespace from the SMTP password (auth-failure guard)', async () => {
    process.env.SMTP_PASS = '  app-password  ';
    await import('../emailService');
    const opts = createTransportMock.mock.calls[0]![0];
    expect(opts.auth.pass).toBe('app-password');
  });

  it('reinitializeTransporter rebuilds the transport', async () => {
    const svc = await import('../emailService');
    const before = createTransportMock.mock.calls.length;
    svc.reinitializeTransporter();
    expect(createTransportMock.mock.calls.length).toBeGreaterThan(before);
  });
});

describe('OTP + verification delivery', () => {
  it('sends a deposit OTP email with the code in the body', async () => {
    const svc = await import('../emailService');
    const ok = await svc.sendDepositOtpEmail('user@example.test', 'Ada', '123456', 50, 'USD');

    expect(ok).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const msg = sendMailMock.mock.calls[0]![0] as any;
    expect(msg.to).toBe('user@example.test');
    expect(msg.subject).toBeTruthy();
    expect(`${msg.html}${msg.text}`).toContain('123456');
  });

  it('sends an email-verification message containing the token', async () => {
    const svc = await import('../emailService');
    const ok = await svc.sendEmailVerification('user@example.test', 'Ada', 'verify-token-xyz');

    expect(ok).toBe(true);
    const msg = sendMailMock.mock.calls[0]![0] as any;
    expect(`${msg.html}${msg.text}`).toContain('verify-token-xyz');
  });

  it('sets a From header built from SMTP_FROM', async () => {
    const svc = await import('../emailService');
    await svc.sendWelcomeEmail('user@example.test', 'Ada');
    const msg = sendMailMock.mock.calls[0]![0] as any;
    expect(msg.from).toContain('noreply@example.test');
  });
});

describe('security: the vulnerable nodemailer options are never used', () => {
  it('never passes the message-level `raw` option (GHSA file-read/SSRF vector)', async () => {
    const svc = await import('../emailService');
    await svc.sendDepositOtpEmail('user@example.test', 'Ada', '999111', 10, 'USD');
    await svc.sendEmailVerification('user@example.test', 'Ada', 'tok');
    await svc.sendPasswordResetEmail('user@example.test', 'Ada', 'tok');

    for (const call of sendMailMock.mock.calls) {
      const msg = call[0] as Record<string, unknown>;
      expect(msg).not.toHaveProperty('raw');
      // No attachment/remote-content surface either: the upgrade's only breaking
      // change (TLS validation when fetching remote content) cannot affect us.
      expect(msg).not.toHaveProperty('attachments');
    }
  });

  it('only ever sends the safe scalar message fields', async () => {
    const svc = await import('../emailService');
    await svc.sendWelcomeEmail('user@example.test', 'Ada');
    const keys = Object.keys(sendMailMock.mock.calls[0]![0] as object).sort();
    expect(keys).toEqual(['from', 'html', 'subject', 'text', 'to']);
  });
});

describe('config gating + error path (fail soft, never throw into callers)', () => {
  it('does not send when SMTP_USER is unset', async () => {
    process.env.SMTP_USER = '';
    const svc = await import('../emailService');
    expect(await svc.sendWelcomeEmail('user@example.test', 'Ada')).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('does not send when SMTP_PASS is unset', async () => {
    process.env.SMTP_PASS = '';
    const svc = await import('../emailService');
    expect(await svc.sendWelcomeEmail('user@example.test', 'Ada')).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('returns false (not throw) when the SMTP transport rejects', async () => {
    sendMailMock.mockRejectedValue(Object.assign(new Error('535 authentication failed'), { code: 'EAUTH' }));
    const svc = await import('../emailService');
    await expect(svc.sendWelcomeEmail('user@example.test', 'Ada')).resolves.toBe(false);
  });

  it('returns false (not throw) on a connection error', async () => {
    sendMailMock.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNECTION' }));
    const svc = await import('../emailService');
    await expect(svc.sendDepositOtpEmail('user@example.test', 'Ada', '1', 1, 'USD')).resolves.toBe(false);
  });

  it('verifySmtpConnection surfaces failure without throwing', async () => {
    verifyMock.mockRejectedValue(Object.assign(new Error('bad creds'), { code: 'EAUTH' }));
    const svc = await import('../emailService');
    const res = await svc.verifySmtpConnection();
    expect(res.success).toBe(false);
  });
});
