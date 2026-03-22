/**
 * Gift Card Pricing Service
 * Fetches market rates and calculates optimal pricing with profit margins
 */

import { getFluzProducts, FluzProduct, isFluzConfigured } from './fluzClient';
import { listOffers, isConfigured as isFluzApiConfigured } from './fluzApi';
import { catalogToGiftCards, getLogoDomain } from './fluzCatalogLoader';
import { logger } from '../middleware/logger';

/** Extract native logo URL from product (Fluz API may return logoUrl, logo_url, image_url, faceplateUrl) */
function getNativeLogo(product: FluzProduct): string | undefined {
  return (
    product.logoUrl ||
    product.logo_url ||
    product.image_url ||
    product.faceplateUrl
  );
}

/** Normalize name for offer matching (lowercase, collapse spaces) */
function normalizeNameForMatch(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Find best-matching offer logo for a product name */
function findOfferLogo(productName: string, offerLogos: Map<string, string>): string | undefined {
  const normalized = normalizeNameForMatch(productName);
  const direct = offerLogos.get(normalized);
  if (direct) return direct;
  for (const [offerName, logoUrl] of offerLogos) {
    if (normalized.includes(offerName) || offerName.includes(normalized)) return logoUrl;
  }
  return undefined;
}

/** Fetch Fluz GraphQL offers and build name->logoUrl map (when API configured) */
async function getOfferLogoMap(): Promise<Map<string, string>> {
  try {
    if (!isFluzApiConfigured()) return new Map();
    const offers = await listOffers();
    const map = new Map<string, string>();
    for (const o of offers) {
      if (o.logoUrl) map.set(normalizeNameForMatch(o.name), o.logoUrl);
    }
    return map;
  } catch {
    return new Map();
  }
}

interface MarketRate {
    brand: string;
    buyRate: number; // What we pay when users sell to us (%)
    sellRate: number; // What users pay when buying from us (%)
    marketAvgRate: number; // Average market rate
    lastUpdated: Date;
}

interface PricingResult {
    brand: string;
    ourBuyRate: number; // Rate we offer when buying from users
    ourSellRate: number; // Rate we charge when selling to users
    costCents: number; // Our cost from Fluz
    profitMarginPercent: number;
    marketRate: number;
}

// Market rates for popular gift cards (industry average)
const MARKET_RATES: Record<string, { buyRate: number; sellRate: number }> = {
    'Amazon': { buyRate: 80, sellRate: 95 },
    'Apple': { buyRate: 78, sellRate: 92 },
    'iTunes': { buyRate: 78, sellRate: 92 },
    'Google Play': { buyRate: 75, sellRate: 90 },
    'Steam': { buyRate: 73, sellRate: 88 },
    'Netflix': { buyRate: 83, sellRate: 95 },
    'Spotify': { buyRate: 81, sellRate: 93 },
    'PlayStation': { buyRate: 74, sellRate: 89 },
    'Xbox': { buyRate: 74, sellRate: 89 },
    'Nike': { buyRate: 85, sellRate: 97 },
    'Starbucks': { buyRate: 82, sellRate: 94 },
    'Target': { buyRate: 85, sellRate: 96 },
    'Walmart': { buyRate: 84, sellRate: 96 },
    'Visa': { buyRate: 88, sellRate: 98 },
    'Mastercard': { buyRate: 88, sellRate: 98 },
};

// Our profit margins (minimum)
const MIN_PROFIT_MARGIN = 5; // 5% minimum profit
const DEFAULT_PROFIT_MARGIN = 8; // 8% default profit
const HIGH_VOLUME_PROFIT_MARGIN = 6; // 6% for high-volume cards

/**
 * Get market rate for a brand
 */
export function getMarketRate(brandName: string): MarketRate {
    const normalizedBrand = Object.keys(MARKET_RATES).find(
        key => brandName.toLowerCase().includes(key.toLowerCase())
    );

    const rates = normalizedBrand
        ? MARKET_RATES[normalizedBrand]
        : { buyRate: 75, sellRate: 90 }; // Default rates

    return {
        brand: brandName,
        buyRate: rates.buyRate,
        sellRate: rates.sellRate,
        marketAvgRate: (rates.buyRate + rates.sellRate) / 2,
        lastUpdated: new Date(),
    };
}

/**
 * Calculate optimal pricing with profit
 */
export function calculatePricing(
    brandName: string,
    amountCents: number,
    fluzCostRate: number = 100 // Fluz typically charges 100% (face value)
): PricingResult {
    const market = getMarketRate(brandName);

    // Our cost from Fluz
    const costCents = Math.round(amountCents * (fluzCostRate / 100));

    // For selling to users: charge slightly below market rate but ensure profit
    const targetProfitMargin = DEFAULT_PROFIT_MARGIN;
    const ourSellRate = Math.min(
        market.sellRate - 2, // Competitive: 2% below market
        fluzCostRate + targetProfitMargin // Ensure minimum profit
    );

    // For buying from users: offer slightly above market buy rate
    const ourBuyRate = Math.max(
        market.buyRate + 1, // Competitive: 1% above market
        fluzCostRate - (targetProfitMargin + 3) // Ensure we can resell with profit
    );

    return {
        brand: brandName,
        ourBuyRate: Math.round(ourBuyRate * 100) / 100,
        ourSellRate: Math.round(ourSellRate * 100) / 100,
        costCents,
        profitMarginPercent: targetProfitMargin,
        marketRate: market.marketAvgRate,
    };
}

/**
 * Fetch all Fluz products and map to our format with pricing.
 * Uses catalog CSV when Fluz API is not configured or USE_FLUZ_CATALOG=true.
 */
export async function fetchAllGiftCardsWithPricing(): Promise<any[]> {
    if (!isFluzConfigured() || process.env.USE_FLUZ_CATALOG === 'true') {
        return getGiftCardsFromCatalog();
    }
    try {
        const [fluzProducts, offerLogos] = await Promise.all([
            getFluzProducts({ currency: 'USD' }),
            getOfferLogoMap(),
        ]);

        const mappedProducts = fluzProducts.items.map((product: FluzProduct) => {
            const pricing = calculatePricing(product.name, 10000); // Sample $100 for calculation
            const slug = (product.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const domain = getLogoDomain(slug, product.name || '');

            // Prefer: 1) product native logo, 2) Fluz offer logo (by name match), 3) Clearbit, 4) Google favicon
            const nativeLogo = getNativeLogo(product) || findOfferLogo(product.name || '', offerLogos);
            const clearbitUrl = domain ? `https://logo.clearbit.com/${domain}` : undefined;
            const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : undefined;
            const primaryLogo = nativeLogo || clearbitUrl;
            const fallbackLogo = faviconUrl || clearbitUrl;

            return {
                id: product.id,
                name: product.name,
                description: product.description,
                icon: 'ri-gift-line',
                color: '#D4AF37',
                bgColor: 'rgba(212, 175, 55, 0.1)',
                logoUrl: primaryLogo,
                logoUrlFallback: primaryLogo !== fallbackLogo ? fallbackLogo : undefined,
                denominations: product.face_values || [],

                // Pricing info
                buyRate: pricing.ourBuyRate,
                sellRate: pricing.ourSellRate,
                rate: pricing.ourSellRate,
                marketRate: pricing.marketRate,
                profitMargin: pricing.profitMarginPercent,

                // Status
                status: product.status || 'available',
                category: determineCategory(product.name, pricing.profitMarginPercent),

                // Metadata
                supplier: 'fluz',
                lastUpdated: new Date().toISOString(),
            };
        });

        logger.info(`Fetched ${mappedProducts.length} gift cards from Fluz with pricing`);
        return mappedProducts;

    } catch (error: any) {
        logger.error('Failed to fetch Fluz gift cards', { error: error?.message });
        return getGiftCardsFromCatalog();
    }
}

/**
 * Get gift cards from Fluz catalog CSV (fallback when Fluz API fails)
 */
export function getGiftCardsFromCatalog(): any[] {
    const cards = catalogToGiftCards();
    if (cards.length > 0) {
        logger.info(`Loaded ${cards.length} gift cards from Fluz catalog CSV`);
        return cards;
    }
    return getFallbackGiftCards();
}

/**
 * Determine category based on profitability
 */
function determineCategory(brandName: string, profitMargin: number): string {
    const topBrands = ['Amazon', 'Apple', 'Netflix', 'Starbucks'];

    if (topBrands.some(brand => brandName.includes(brand))) {
        return 'top';
    }

    if (profitMargin >= 8) {
        return 'high-rate';
    }

    return 'regular';
}

/**
 * Fallback gift cards if Fluz fails
 */
function getFallbackGiftCards() {
    const cards = [
        { id: 'amazon', name: 'Amazon', icon: 'ri-amazon-fill', color: '#FF9900', bgColor: 'rgba(255, 153, 0, 0.15)', logoUrl: 'https://logo.clearbit.com/amazon.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=amazon.com&sz=128', denominations: [25, 50, 100, 200, 500], buyRate: 81, sellRate: 93, rate: 93, marketRate: 87.5, profitMargin: 8, category: 'top' as const },
        { id: 'apple', name: 'Apple/iTunes', icon: 'ri-apple-fill', color: '#A2AAAD', bgColor: 'rgba(162, 170, 173, 0.15)', logoUrl: 'https://logo.clearbit.com/apple.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=apple.com&sz=128', denominations: [25, 50, 100, 200], buyRate: 79, sellRate: 90, rate: 90, marketRate: 85, profitMargin: 8, category: 'top' as const },
        { id: 'google-play', name: 'Google Play', icon: 'ri-google-play-fill', color: '#34A853', bgColor: 'rgba(52, 168, 83, 0.15)', logoUrl: 'https://logo.clearbit.com/play.google.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=play.google.com&sz=128', denominations: [15, 25, 50, 100], buyRate: 76, sellRate: 88, rate: 88, marketRate: 82.5, profitMargin: 8, category: 'regular' as const },
        { id: 'steam', name: 'Steam', icon: 'ri-steam-fill', color: '#1B2838', bgColor: 'rgba(27, 40, 56, 0.25)', logoUrl: 'https://logo.clearbit.com/store.steampowered.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=128', denominations: [20, 50, 100], buyRate: 74, sellRate: 86, rate: 86, marketRate: 80.5, profitMargin: 8, category: 'regular' as const },
        { id: 'netflix', name: 'Netflix', icon: 'ri-netflix-fill', color: '#E50914', bgColor: 'rgba(229, 9, 20, 0.15)', logoUrl: 'https://logo.clearbit.com/netflix.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=netflix.com&sz=128', denominations: [25, 50, 100], buyRate: 84, sellRate: 93, rate: 93, marketRate: 90, profitMargin: 8, category: 'high-rate' as const },
        { id: 'spotify', name: 'Spotify', icon: 'ri-spotify-fill', color: '#1DB954', bgColor: 'rgba(29, 185, 84, 0.15)', logoUrl: 'https://logo.clearbit.com/spotify.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=128', denominations: [10, 30, 60], buyRate: 82, sellRate: 91, rate: 91, marketRate: 87, profitMargin: 8, category: 'high-rate' as const },
    ];
    return cards;
}

/**
 * Calculate profit for a transaction
 */
export function calculateTransactionProfit(
    type: 'buy' | 'sell',
    brandName: string,
    amountCents: number,
    userRate: number
): { costCents: number; profitCents: number; profitPercent: number } {
    const pricing = calculatePricing(brandName, amountCents);

    if (type === 'buy') {
        // User is buying from us
        const revenue = Math.round(amountCents * (userRate / 100));
        const cost = pricing.costCents;
        const profit = revenue - cost;

        return {
            costCents: cost,
            profitCents: profit,
            profitPercent: (profit / cost) * 100,
        };
    } else {
        // User is selling to us (we're buying)
        const cost = Math.round(amountCents * (userRate / 100)); // What we pay user
        const potentialRevenue = Math.round(amountCents * (pricing.ourSellRate / 100)); // What we can sell for
        const profit = potentialRevenue - cost;

        return {
            costCents: cost,
            profitCents: profit,
            profitPercent: (profit / cost) * 100,
        };
    }
}
