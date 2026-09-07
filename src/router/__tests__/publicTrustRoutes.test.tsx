import { describe, expect, it } from 'vitest';
import ProtectedRoute from '../../components/ProtectedRoute';
import routes from '../config';

function route(path: string) {
  return routes.find((candidate) => candidate.path === path);
}

describe('public trust routes', () => {
  it.each(['/about', '/support', '/terms', '/privacy', '/refund-policy', '/aml-policy'])(
    '%s is registered',
    (path) => {
      expect(route(path)).toBeDefined();
    },
  );

  it('keeps support public so signed-out users can reach help', () => {
    const support = route('/support');
    const element = support?.element as { type?: unknown } | undefined;

    expect(element?.type).not.toBe(ProtectedRoute);
  });

  it('keeps financial account routes protected', () => {
    for (const path of ['/wallet', '/transactions', '/cards', '/transfer']) {
      const protectedRoute = route(path);
      const element = protectedRoute?.element as { type?: unknown } | undefined;

      expect(element?.type).toBe(ProtectedRoute);
    }
  });
});

describe('public trust page modules', () => {
  it('loads the refund policy module', async () => {
    const module = await import('../../pages/refund-policy/page');
    expect(typeof module.default).toBe('function');
  });

  it('loads the company page module', async () => {
    const module = await import('../../pages/about/page');
    expect(typeof module.default).toBe('function');
  });

  it('loads the public support module', async () => {
    const module = await import('../../pages/support/page');
    expect(typeof module.default).toBe('function');
  });
});
