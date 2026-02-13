/**
 * Card Product Service
 * Manages virtual/physical card products for card checkout
 */

import { getFluzProducts, FluzProduct } from './fluzClient';
import { logger } from '../middleware/logger';

export interface CardProduct {
    id: string;
    name: string;
    type: 'virtual' | 'physical';
    network: 'visa' | 'mastercard' | 'amex';
    description: string;
    denominations: number[];
    minAmount: number;
    maxAmount: number;
    currency: string;
    processingFee: number; // Fee in percentage
    deliveryTime: string;
    features: string[];
    available: boolean;
}

const PROVIDER_CARD_PRODUCTS = {
    VIRTUAL_VISA_US: '1800FL-US', // Current one
    VIRTUAL_MASTERCARD_US: '1800MC-US',
    PHYSICAL_VISA_US: '1800PV-US',
    VIRTUAL_VISA_EU: '1800FL-EU',
    VIRTUAL_MASTERCARD_EU: '1800MC-EU',
};

/**
 * Get available card products for checkout
 */
export async function getCardProducts(currency: string = 'USD'): Promise<CardProduct[]> {
    try {
        const providerProducts = await getFluzProducts({ currency });

        const cardProducts = providerProducts.items
            .filter((p: FluzProduct) => {
                // Card products typically have specific patterns in their IDs
                const isCard = p.id.includes('FL-') || p.id.includes('CARD') ||
                    p.name.toLowerCase().includes('visa') ||
                    p.name.toLowerCase().includes('mastercard');
                return isCard;
            })
            .map((p: FluzProduct) => mapProviderProductToCardProduct(p));

        if (cardProducts.length > 0) {
            logger.info(`Fetched ${cardProducts.length} card products from provider`);
            return cardProducts;
        }
    } catch (error: any) {
        logger.error('Failed to fetch card products from provider', { error: error?.message });
    }

    // Fallback to default products
    return getDefaultCardProducts(currency);
}

function mapProviderProductToCardProduct(product: FluzProduct): CardProduct {
    const isPhysical = product.name.toLowerCase().includes('physical');
    const isVisa = product.name.toLowerCase().includes('visa');
    const isMastercard = product.name.toLowerCase().includes('mastercard');
    const isAmex = product.name.toLowerCase().includes('amex');

    return {
        id: product.id,
        name: product.name,
        type: isPhysical ? 'physical' : 'virtual',
        network: isAmex ? 'amex' : (isMastercard ? 'mastercard' : 'visa'),
        description: product.description || `${isPhysical ? 'Physical' : 'Virtual'} prepaid card`,
        denominations: product.face_values || [100, 250, 500, 1000, 2500],
        minAmount: Math.min(...(product.face_values || [100])),
        maxAmount: Math.max(...(product.face_values || [2500])),
        currency: product.currency || 'USD',
        processingFee: 2.5, // 2.5% processing fee
        deliveryTime: isPhysical ? '5-7 business days' : 'Instant',
        features: [
            'Secure and encrypted',
            'Global acceptance',
            isPhysical ? 'Physical card mailed to you' : 'Instant virtual card',
            'FDIC insured',
            '24/7 customer support',
        ],
        available: product.status === 'available' || product.status === 'ACTIVE',
    };
}

/**
 * Default card products (fallback if provider unavailable)
 */
function getDefaultCardProducts(currency: string): CardProduct[] {
    const products: CardProduct[] = [
        {
            id: 'virtual-visa-us',
            name: 'Virtual Visa Card',
            type: 'virtual',
            network: 'visa',
            description: 'Instant virtual Visa card for online payments',
            denominations: [100, 250, 500, 1000, 2500],
            minAmount: 100,
            maxAmount: 2500,
            currency: 'USD',
            processingFee: 2.5,
            deliveryTime: 'Instant',
            features: [
                'Instant delivery',
                'Use anywhere Visa is accepted online',
                'Secure 16-digit card number',
                'CVV and expiry date included',
                'Perfect for online shopping',
            ],
            available: true,
        },
        {
            id: 'virtual-mastercard-us',
            name: 'Virtual Mastercard',
            type: 'virtual',
            network: 'mastercard',
            description: 'Instant virtual Mastercard for global use',
            denominations: [100, 250, 500, 1000, 2500],
            minAmount: 100,
            maxAmount: 2500,
            currency: 'USD',
            processingFee: 2.5,
            deliveryTime: 'Instant',
            features: [
                'Instant delivery',
                'Global acceptance',
                'Secure and encrypted',
                'Perfect for subscriptions',
                '24/7 support',
            ],
            available: true,
        },
        {
            id: 'physical-visa-us',
            name: 'Physical Visa Card',
            type: 'physical',
            network: 'visa',
            description: 'Physical Visa prepaid card shipped to your address',
            denominations: [100, 250, 500, 1000],
            minAmount: 100,
            maxAmount: 1000,
            currency: 'USD',
            processingFee: 5.0, // Higher fee for physical
            deliveryTime: '5-7 business days',
            features: [
                'Physical card mailed to you',
                'Use at ATMs and in-store',
                'PIN protected',
                'FDIC insured',
                'Rechargeable',
            ],
            available: true,
        },
    ];

    // Filter by currency
    return products.filter(p => p.currency === currency);
}

/**
 * Get a specific card product by ID
 */
export async function getCardProductById(productId: string): Promise<CardProduct | null> {
    const products = await getCardProducts();
    return products.find(p => p.id === productId) || null;
}

/**
 * Calculate card checkout cost with fees
 */
export function calculateCardCheckoutCost(
    amount: number,
    productId: string,
    products: CardProduct[]
): {
    amount: number;
    processingFee: number;
    totalCost: number;
    productName: string;
} {
    const product = products.find(p => p.id === productId);

    if (!product) {
        throw new Error('Card product not found');
    }

    const processingFee = Math.round(amount * (product.processingFee / 100) * 100) / 100;
    const totalCost = amount + processingFee;

    return {
        amount,
        processingFee,
        totalCost,
        productName: product.name,
    };
}

/**
 * Validate card amount against product limits
 */
export function validateCardAmount(
    amount: number,
    productId: string,
    products: CardProduct[]
): { valid: boolean; error?: string } {
    const product = products.find(p => p.id === productId);

    if (!product) {
        return { valid: false, error: 'Invalid card product' };
    }

    if (!product.available) {
        return { valid: false, error: 'This card product is currently unavailable' };
    }

    if (amount < product.minAmount) {
        return { valid: false, error: `Minimum amount is $${product.minAmount}` };
    }

    if (amount > product.maxAmount) {
        return { valid: false, error: `Maximum amount is $${product.maxAmount}` };
    }

    return { valid: true };
}

export function getProviderProductId(cardProductId: string): string {
    const mapping: Record<string, string> = {
        'virtual-visa-us': PROVIDER_CARD_PRODUCTS.VIRTUAL_VISA_US,
        'virtual-mastercard-us': PROVIDER_CARD_PRODUCTS.VIRTUAL_MASTERCARD_US,
        'physical-visa-us': PROVIDER_CARD_PRODUCTS.PHYSICAL_VISA_US,
        'virtual-visa-eu': PROVIDER_CARD_PRODUCTS.VIRTUAL_VISA_EU,
        'virtual-mastercard-eu': PROVIDER_CARD_PRODUCTS.VIRTUAL_MASTERCARD_EU,
    };

    return mapping[cardProductId] || PROVIDER_CARD_PRODUCTS.VIRTUAL_VISA_US;
}
