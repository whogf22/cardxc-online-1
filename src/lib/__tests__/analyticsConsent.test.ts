/**
 * Analytics consent-gating tests.
 *
 * COMPLIANCE FEEDBACK LOOP: proves trackEvent() performs NO network I/O until
 * the user has accepted non-essential tracking, even in production mode.
 */

import { afterEach, beforeEach, vi } from 'vitest';
import { setConsent } from '../consent';

const ENDPOINT = 'https://analytics.example.test/collect';

describe('analytics consent gating (production mode)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ANALYTICS_ENDPOINT', ENDPOINT);
    fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not send analytics when no consent decision has been made', async () => {
    const { trackEvent } = await import('../analytics');
    trackEvent('user_login', { method: 'email' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send analytics when the user rejected non-essential cookies', async () => {
    setConsent('rejected');
    const { trackEvent } = await import('../analytics');
    trackEvent('user_login', { method: 'email' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends analytics only after the user accepts', async () => {
    setConsent('accepted');
    const { trackEvent } = await import('../analytics');
    trackEvent('user_login', { method: 'email' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({ method: 'POST' }));
  });
});
