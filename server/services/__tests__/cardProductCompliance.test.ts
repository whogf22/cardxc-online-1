/**
 * @vitest-environment node
 *
 * Compliance guard tests for card product metadata.
 *
 * Background: card product `features` are returned verbatim to the client via
 * `GET /checkout/card-products` and rendered as product selling points. They must
 * never assert FDIC insurance or unqualified guarantees, because false FDIC
 * representations are independently unlawful (12 U.S.C. 1828(a), 12 CFR Part 328)
 * and unqualified guarantees are deceptive under FTC Act 5. This test fails loudly
 * if any prohibited claim is reintroduced in either the provider-mapped path or the
 * default fallback path.
 */
import { afterEach, vi, describe, it, expect } from 'vitest';

const mockGetFluzProducts = vi.fn();

vi.mock('../fluzClient', () => ({
  getFluzProducts: (...args: unknown[]) => mockGetFluzProducts(...args),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getCardProducts, CardProduct } from '../cardProductService';

// Phrases that must never appear in user-facing card product copy.
const PROHIBITED = [
  /fdic/i,
  /\binsured\b/i,
  /\bguarantee/i,
  /100%\s*(safe|secure)/i,
];

function assertClean(products: CardProduct[]) {
  expect(products.length).toBeGreaterThan(0);
  for (const product of products) {
    const haystack = [product.name, product.description, ...product.features].join(' | ');
    for (const pattern of PROHIBITED) {
      expect(
        pattern.test(haystack),
        `Prohibited claim ${pattern} found in product "${product.id}": ${haystack}`,
      ).toBe(false);
    }
  }
}

afterEach(() => {
  mockGetFluzProducts.mockReset();
});

describe('card product compliance', () => {
  it('default fallback products contain no FDIC/guarantee claims', async () => {
    // Force the fallback path by making the provider throw.
    mockGetFluzProducts.mockRejectedValueOnce(new Error('provider down'));
    const products = await getCardProducts('USD');
    assertClean(products);
  });

  it('provider-mapped products contain no FDIC/guarantee claims', async () => {
    mockGetFluzProducts.mockResolvedValueOnce({
      items: [
        {
          id: '1800FL-US',
          name: 'Virtual Visa Card',
          description: 'Virtual prepaid card',
          currency: 'USD',
          face_values: [100, 250, 500],
          status: 'available',
        },
      ],
    });
    const products = await getCardProducts('USD');
    assertClean(products);
  });
});
