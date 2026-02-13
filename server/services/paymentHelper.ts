/**
 * Payment Helper Service
 * Generates unique merchant names for bank statements
 */

const MERCHANTS = [
    'TechZone Electronics',
    'Metro Digital Services',
    'Global Travel Hub',
    'Prime Retail Direct',
    'Star Coffee & Tea',
    'Elite Fitness Gear',
    'Urban Style Loft',
    'Green Valley Grocers',
    'Nova Software Solutions',
    'Blue Sky Logistics',
    'Rapid Transit Sys',
    'Alpha Gaming Store',
    'Zenith Health Labs',
    'Swift Courier Co',
    'Bright Future Edu',
    'Cloud Nine Hosting',
    'River Side Bookstore',
    'Neon Night Club',
    'Solar Power Direct',
    'Ocean Blue Seafood'
];

/**
 * Generate a random realistic merchant name
 * Used for statement descriptors to maintain privacy
 */
export function generateStatementDescriptor(): string {
    const randomIndex = Math.floor(Math.random() * MERCHANTS.length);
    // Add a random 3-digit order ID for uniqueness
    const orderId = Math.floor(100 + Math.random() * 900);
    return `${MERCHANTS[randomIndex]} ${orderId}`.substring(0, 22); // Max 22 chars for Stripe
}

/**
 * Get a random industry category code (MCC)
 * Useful for advanced payment gateways
 */
export function getRandomMCC(): string {
    const mccs = ['5411', '5732', '5812', '5651', '5999'];
    return mccs[Math.floor(Math.random() * mccs.length)];
}
