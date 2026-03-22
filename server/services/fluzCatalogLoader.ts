/**
 * Load Fluz gift card catalog from CSV (fallback when Fluz API is unavailable)
 * CSV format: name,slug,denominations,denomination_type,rate
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../middleware/logger';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface FluzCatalogRow {
  name: string;
  slug: string;
  denominations: number[];
  denominationType: string;
  rate: number;
}

export interface GiftCardFromCatalog {
  id: string;
  name: string;
  denominations: number[];
  buyRate: number;
  sellRate: number;
  rate: number;
  marketRate: number;
  profitMargin: number;
  category: string;
  icon: string;
  color: string;
  bgColor: string;
  logoUrl?: string;
  logoUrlFallback?: string;
  status: string;
  supplier: string;
  lastUpdated: string;
}

const TOP_BRANDS = ['amazon', 'apple', 'netflix', 'starbucks', 'walmart', 'target', 'google'];

/** Map brand slug/name to domain for logo URL (Clearbit/Logo.dev style) */
const BRAND_DOMAINS: Record<string, string> = {
  amazon: 'amazon.com',
  apple: 'apple.com',
  netflix: 'netflix.com',
  starbucks: 'starbucks.com',
  walmart: 'walmart.com',
  target: 'target.com',
  chipotle: 'chipotle.com',
  dunkin: 'dunkindonuts.com',
  'dunkin\'': 'dunkindonuts.com',
  dominos: 'dominos.com',
  'pizza-hut': 'pizzahut.com',
  subway: 'subway.com',
  mcdonalds: 'mcdonalds.com',
  'burger-king': 'burgerking.com',
  'taco-bell': 'tacobell.com',
  'google-play': 'play.google.com',
  steam: 'store.steampowered.com',
  xbox: 'xbox.com',
  playstation: 'playstation.com',
  nintendo: 'nintendo.com',
  spotify: 'spotify.com',
  hulu: 'hulu.com',
  'disney-plus': 'disneyplus.com',
  bestbuy: 'bestbuy.com',
  homedepot: 'home-depot.com',
  'home-depot': 'homedepot.com',
  lowes: 'lowes.com',
  costco: 'costco.com',
  'sams-club': 'samsclub.com',
  cvs: 'cvs.com',
  walgreens: 'walgreens.com',
  '1-800-flowers': '1800flowers.com',
  '1-800-baskets': '1800baskets.com',
  '1800-pet-supplies': '1800petsupplies.com',
  'office-depot-office-max': 'officedepot.com',
  gamestop: 'gamestop.com',
  uber: 'uber.com',
  lyft: 'lyft.com',
  doordash: 'doordash.com',
  grubhub: 'grubhub.com',
  instacart: 'instacart.com',
  airbnb: 'airbnb.com',
  nordstrom: 'nordstrom.com',
  macys: 'macys.com',
  kohls: 'kohls.com',
  gap: 'gap.com',
  nike: 'nike.com',
  adidas: 'adidas.com',
  ebay: 'ebay.com',
  etsy: 'etsy.com',
  wayfair: 'wayfair.com',
  chewy: 'chewy.com',
  petsmart: 'petsmart.com',
  petco: 'petco.com',
  chilis: 'chilis.com',
  'krispy-kreme': 'krispykreme.com',
  'krispy-kreme-doughnut': 'krispykreme.com',
  'shake-shack': 'shakeshack.com',
  'logans-roadhouse': 'logansroadhouse.com',
  'smashburger': 'smashburger.com',
  'sweetfrog': 'sweetfrog.com',
  'tractor-supply': 'tractorsupply.com',
  'tractor-supply-company': 'tractorsupply.com',
  'tops-markets': 'topsmarkets.com',
  'surestay': 'surestay.com',
  'sheraton': 'marriott.com',
  'four-points-by-sheraton': 'marriott.com',
  'ac-hotels': 'marriott.com',
  'ac-hotels-by-marriott': 'marriott.com',
  'indieflix': 'indieflix.com',
  'chicos': 'chicos.com',
  'thirdlove': 'thirdlove.com',
  'the-popcorn-factory': 'popcornfactory.com',
  'soothe': 'soothe.com',
};

export function getLogoDomain(slug: string, name: string): string | null {
  const slugLower = slug.toLowerCase();
  const direct = BRAND_DOMAINS[slugLower];
  if (direct) return direct;
  for (const [key, domain] of Object.entries(BRAND_DOMAINS)) {
    if (slugLower.includes(key) || name.toLowerCase().includes(key.replace(/-/g, ' '))) return domain;
  }
  const cleaned = slugLower.replace(/[^a-z0-9]/g, '');
  if (cleaned.length >= 4) return `${cleaned}.com`;
  return null;
}

function parseDenominations(raw: string): number[] {
  try {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    // Handle [25,500] or [1050] or [9.98,14.97]
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((n: number) => Math.round(n * 100) / 100);
    }
    return [Number(parsed)];
  } catch {
    return [];
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Load and parse the Fluz catalog CSV
 */
export function loadFluzCatalogFromCSV(): FluzCatalogRow[] {
  const catalogPath = join(__dirname, '../data/fluz-catalog.csv');
  if (!existsSync(catalogPath)) {
    logger.warn('Fluz catalog CSV not found', { path: catalogPath });
    return [];
  }

  const content = readFileSync(catalogPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const rows: FluzCatalogRow[] = [];
  // CSV format: name,slug,denominations,denomination_type,rate
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 5) continue;

    const name = parts[0]?.trim() || '';
    const slug = (parts[1] || name.toLowerCase().replace(/\s+/g, '-')).trim();
    const denominations = parseDenominations(parts[2] || '[]');
    const rate = parseFloat(parts[4] || '0') || 0;

    if (!name || denominations.length === 0) continue;

    rows.push({
      name,
      slug,
      denominations,
      denominationType: parts[3] || 'VARIABLE',
      rate,
    });
  }

  return rows;
}

/**
 * Merge rows by slug (same merchant can have multiple rows for FIXED/VARIABLE)
 */
function mergeBySlug(rows: FluzCatalogRow[]): Map<string, FluzCatalogRow> {
  const map = new Map<string, FluzCatalogRow>();
  for (const row of rows) {
    const existing = map.get(row.slug);
    if (!existing) {
      map.set(row.slug, { ...row });
    } else {
      const combined = new Set([...existing.denominations, ...row.denominations]);
      existing.denominations = Array.from(combined).sort((a, b) => a - b);
      if (row.rate > existing.rate) existing.rate = row.rate;
    }
  }
  return map;
}

/**
 * Convert catalog to gift card format for API
 */
export function catalogToGiftCards(): GiftCardFromCatalog[] {
  const rows = loadFluzCatalogFromCSV();
  const merged = mergeBySlug(rows);

  const cards: GiftCardFromCatalog[] = [];
  for (const row of merged.values()) {
    const slug = row.slug.toLowerCase();
    const isTop = TOP_BRANDS.some((b) => slug.includes(b));
    const sellRate = 100 - row.rate / 2;
    const buyRate = Math.max(70, 100 - row.rate - 5);
    const profitMargin = Math.round((sellRate - buyRate) * 10) / 10;

    const domain = getLogoDomain(row.slug, row.name);
    // Fluz-style: Clearbit for quality logos, Google favicon as reliable fallback (sz=128)
    const logoUrl = domain
      ? `https://logo.clearbit.com/${domain}`
      : undefined;
    const logoUrlFallback = domain
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      : undefined;

    const rate = Math.round(sellRate * 10) / 10;
    cards.push({
      id: row.slug,
      name: row.name,
      denominations: row.denominations,
      buyRate: Math.round(buyRate * 10) / 10,
      sellRate: rate,
      rate,
      marketRate: Math.round(((buyRate + sellRate) / 2) * 10) / 10,
      profitMargin,
      category: isTop ? 'top' : profitMargin >= 8 ? 'high-rate' : 'regular',
      icon: 'ri-gift-line',
      color: '#D4AF37',
      bgColor: 'rgba(212, 175, 55, 0.1)',
      logoUrl,
      logoUrlFallback,
      status: 'available',
      supplier: 'fluz-catalog',
      lastUpdated: new Date().toISOString(),
    });
  }

  return cards.sort((a, b) => a.name.localeCompare(b.name));
}
