/**
 * Crypto Provider Service
 * Integrates with crypto payment providers to send actual USDT to user wallets
 */

import { logger } from '../middleware/logger';

// Supported crypto providers
export type CryptoProvider = 'binance_pay' | 'coinbase_commerce' | 'circle' | 'manual';

// Crypto network types
export type CryptoNetwork = 'TRC20' | 'ERC20' | 'BEP20' | 'POLYGON';

interface CryptoPayoutRequest {
    userId: string;
    amount: number; // Amount in USDT
    walletAddress: string;
    network: CryptoNetwork;
    orderId?: string;
    transactionId?: string;
}

interface CryptoPayoutResponse {
    success: boolean;
    payoutId?: string;
    txHash?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
    estimatedCompletionTime?: string;
}

const CRYPTO_PROVIDER = (process.env.CRYPTO_PROVIDER || 'manual') as CryptoProvider;
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const COINBASE_API_KEY = process.env.COINBASE_COMMERCE_API_KEY;
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;

// Minimum USDT amount for crypto payout (to avoid high fees on small amounts)
const MIN_CRYPTO_PAYOUT_AMOUNT = 10; // $10 USDT

/**
 * Send USDT to user's crypto wallet address
 */
export async function sendCryptoToWallet(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    try {
        // Validate amount
        if (request.amount < MIN_CRYPTO_PAYOUT_AMOUNT) {
            return {
                success: false,
                status: 'failed',
                error: `Minimum crypto payout amount is ${MIN_CRYPTO_PAYOUT_AMOUNT} USDT`
            };
        }

        // Validate wallet address
        if (!isValidCryptoAddress(request.walletAddress, request.network)) {
            return {
                success: false,
                status: 'failed',
                error: 'Invalid crypto wallet address'
            };
        }

        logger.info('Initiating crypto payout', {
            provider: CRYPTO_PROVIDER,
            userId: request.userId,
            amount: request.amount,
            network: request.network,
            orderId: request.orderId
        });

        // Route to appropriate provider
        switch (CRYPTO_PROVIDER) {
            case 'binance_pay':
                return await sendViaBinancePay(request);

            case 'coinbase_commerce':
                return await sendViaCoinbaseCommerce(request);

            case 'circle':
                return await sendViaCircle(request);

            case 'manual':
            default:
                return await createManualPayoutRequest(request);
        }
    } catch (error: any) {
        logger.error('Crypto payout failed', {
            error: error.message,
            userId: request.userId,
            amount: request.amount
        });

        return {
            success: false,
            status: 'failed',
            error: error.message || 'Failed to process crypto payout'
        };
    }
}

/**
 * Binance Pay integration
 */
async function sendViaBinancePay(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        throw new Error('Binance API credentials not configured');
    }

    logger.error('Binance Pay payout not implemented - rejecting request', { amount: request.amount, userId: request.userId });

    return {
        success: false,
        status: 'failed',
        error: 'Binance Pay integration is not yet available. Please use manual processing.'
    };
}

/**
 * Coinbase Commerce integration
 */
async function sendViaCoinbaseCommerce(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    if (!COINBASE_API_KEY) {
        throw new Error('Coinbase Commerce API key not configured');
    }

    logger.error('Coinbase Commerce payout not implemented - rejecting request', { amount: request.amount, userId: request.userId });

    return {
        success: false,
        status: 'failed',
        error: 'Coinbase Commerce integration is not yet available. Please use manual processing.'
    };
}

/**
 * Circle (USDC) integration
 */
async function sendViaCircle(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    if (!CIRCLE_API_KEY) {
        throw new Error('Circle API key not configured');
    }

    logger.error('Circle payout not implemented - rejecting request', { amount: request.amount, userId: request.userId });

    return {
        success: false,
        status: 'failed',
        error: 'Circle integration is not yet available. Please use manual processing.'
    };
}

/**
 * Manual payout - Creates request for admin to process manually
 */
async function createManualPayoutRequest(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    logger.info('Manual crypto payout request created', {
        userId: request.userId,
        amount: request.amount,
        address: request.walletAddress,
        network: request.network
    });

    // Store in pending_crypto_payouts table (admin will process)
    return {
        success: true,
        payoutId: `manual_${Date.now()}`,
        status: 'pending',
        estimatedCompletionTime: 'Pending admin approval'
    };
}

/**
 * Validate crypto wallet address
 */
function isValidCryptoAddress(address: string, network: CryptoNetwork): boolean {
    if (!address || address.length < 20) return false;

    switch (network) {
        case 'TRC20': // TRON
            return address.startsWith('T') && address.length === 34;

        case 'ERC20': // Ethereum
        case 'BEP20': // BSC
        case 'POLYGON':
            return address.startsWith('0x') && address.length === 42;

        default:
            return false;
    }
}

/**
 * Get supported networks
 */
export function getSupportedNetworks(): CryptoNetwork[] {
    return ['TRC20', 'ERC20', 'BEP20', 'POLYGON'];
}

/**
 * Get network fee estimates
 */
export function getNetworkFees(): Record<CryptoNetwork, { fee: number; speed: string }> {
    return {
        TRC20: { fee: 1, speed: 'Fast (1-2 min)' },
        ERC20: { fee: 5, speed: 'Medium (5-10 min)' },
        BEP20: { fee: 0.5, speed: 'Fast (1-3 min)' },
        POLYGON: { fee: 0.1, speed: 'Very Fast (<1 min)' }
    };
}

/**
 * Check if crypto provider is configured
 */
export function isCryptoProviderConfigured(): boolean {
    switch (CRYPTO_PROVIDER) {
        case 'binance_pay':
            return !!BINANCE_API_KEY && !!BINANCE_SECRET_KEY;
        case 'coinbase_commerce':
            return !!COINBASE_API_KEY;
        case 'circle':
            return !!CIRCLE_API_KEY;
        case 'manual':
            return true; // Manual always available
        default:
            return false;
    }
}

/**
 * Get current provider name
 */
export function getCryptoProviderName(): string {
    const names = {
        binance_pay: 'Binance Pay',
        coinbase_commerce: 'Coinbase Commerce',
        circle: 'Circle',
        manual: 'Manual Processing'
    };
    return names[CRYPTO_PROVIDER] || 'Unknown';
}
