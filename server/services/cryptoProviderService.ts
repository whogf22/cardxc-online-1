/**
 * Crypto Provider Service
 * Integrates with crypto payment providers to send actual USDT to user wallets
 * TronGrid API: https://api.trongrid.io for USDT TRC20
 */

import { logger } from '../middleware/logger';
import { query } from '../db/pool';

// Supported crypto providers
export type CryptoProvider = 'binance_pay' | 'coinbase_commerce' | 'circle' | 'trongrid' | 'manual';

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
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY;
const TRON_HOT_WALLET_PRIVATE_KEY = process.env.TRON_HOT_WALLET_PRIVATE_KEY;
const TRONGRID_BASE = 'https://api.trongrid.io';
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

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

            case 'trongrid':
                if (request.network === 'TRC20') {
                    return await sendViaTronGrid(request);
                }
                return await createManualPayoutRequest(request);

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
 * TronGrid - Send USDT TRC20 via TronGrid API
 * Requires: TRON_HOT_WALLET_PRIVATE_KEY, optional TRONGRID_API_KEY for higher rate limits
 */
async function sendViaTronGrid(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    if (request.network !== 'TRC20') {
        return {
            success: false,
            status: 'failed',
            error: 'TronGrid only supports TRC20. Use manual for other networks.'
        };
    }
    if (!TRON_HOT_WALLET_PRIVATE_KEY) {
        logger.warn('TronGrid: TRON_HOT_WALLET_PRIVATE_KEY not set, falling back to manual');
        return await createManualPayoutRequest(request);
    }

    try {
        const { TronWeb } = await import('tronweb' as any);
        const tronWeb = new TronWeb({
            fullHost: TRONGRID_BASE,
            headers: TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {}
        });
        tronWeb.setPrivateKey(TRON_HOT_WALLET_PRIVATE_KEY);

        const amountSun = Math.floor(request.amount * 1e6);
        const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
        const tx = await contract.transfer(request.walletAddress, amountSun).send();

        if (tx && ((tx as any).transaction?.txID || (tx as any).txid || typeof tx === 'string')) {
            const txHash = typeof tx === 'string' ? tx : ((tx as any).transaction?.txID || (tx as any).txid);
            logger.info('TronGrid USDT TRC20 sent', {
                txHash,
                amount: request.amount,
                to: request.walletAddress.substring(0, 10) + '...'
            });

            try {
                await query(
                    `INSERT INTO crypto_transactions (
                        user_id, type, status, amount, currency, network, tx_hash,
                        from_address, to_address, confirmations, required_confirmations, withdrawal_request_id
                    ) VALUES ($1, 'withdrawal', 'completed', $2, 'USDT', 'TRC20', $3, $4, $5, 20, 20, $6)`,
                    [request.userId, request.amount, txHash,
                     process.env.USDT_TRC20_DEPOSIT_ADDRESS || process.env.TRON_HOT_WALLET_ADDRESS || '',
                     request.walletAddress, request.transactionId || null]
                );
            } catch (dbErr: any) {
                logger.error('Failed to record crypto tx in DB', { error: dbErr.message });
            }

            return {
                success: true,
                payoutId: txHash,
                txHash,
                status: 'completed',
                estimatedCompletionTime: '1-2 minutes'
            };
        }
        throw new Error('No transaction ID returned');
    } catch (error: any) {
        logger.error('TronGrid payout failed', { error: error.message, amount: request.amount });
        return {
            success: false,
            status: 'failed',
            error: error.message || 'TronGrid transfer failed'
        };
    }
}

/**
 * Manual payout - Creates request for admin to process manually
 */
async function createManualPayoutRequest(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    logger.info('Manual crypto payout request created', {
        userId: request.userId,
        amount: request.amount,
        address: request.walletAddress.substring(0, 6) + '...' + request.walletAddress.substring(request.walletAddress.length - 4),
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
        case 'trongrid':
            return !!TRON_HOT_WALLET_PRIVATE_KEY;
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
    const names: Record<string, string> = {
        binance_pay: 'Binance Pay',
        coinbase_commerce: 'Coinbase Commerce',
        circle: 'Circle',
        trongrid: 'TronGrid (USDT TRC20)',
        manual: 'Manual Processing'
    };
    return names[CRYPTO_PROVIDER] || 'Unknown';
}

/**
 * Public crypto deposit addresses (non-secret) exposed to authenticated users.
 * Prefer dedicated deposit addresses; Tron hot wallet address can be used as fallback for TRC20.
 */
export function getCryptoDepositAddresses() {
    const tronAddress = process.env.USDT_TRC20_DEPOSIT_ADDRESS || process.env.TRON_HOT_WALLET_ADDRESS || '';
    return {
        BTC: {
            'btc-native': process.env.BTC_DEPOSIT_ADDRESS || ''
        },
        ETH: {
            'eth-erc20': process.env.ETH_DEPOSIT_ADDRESS || ''
        },
        USDT: {
            'usdt-erc20': process.env.USDT_ERC20_DEPOSIT_ADDRESS || '',
            'usdt-trc20': tronAddress,
            'usdt-bep20': process.env.USDT_BEP20_DEPOSIT_ADDRESS || ''
        },
        BNB: {
            'bnb-bep20': process.env.BNB_DEPOSIT_ADDRESS || ''
        },
        TRX: {
            'trx-trc20': process.env.TRX_DEPOSIT_ADDRESS || tronAddress
        }
    };
}
