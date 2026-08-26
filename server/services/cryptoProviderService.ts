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

/**
 * Broadcast-safety classification for a payout attempt. This drives the refund
 * decision in the withdrawal service (CRITICAL-2):
 *
 *  - 'not_sent'       — we KNOW no on-chain broadcast happened (validation
 *                       failed, provider unconfigured/unimplemented, or the
 *                       failure occurred strictly before .send()). Safe to
 *                       refund.
 *  - 'confirmed_sent' — a broadcast completed and returned a recognized tx id.
 *                       Funds have left custody; never refund.
 *  - 'unknown'        — the broadcast may or may not have happened (the send
 *                       threw, or returned an unrecognized shape). NEVER
 *                       auto-refund; route to manual reconciliation.
 */
export type PayoutOutcome = 'not_sent' | 'confirmed_sent' | 'unknown';

// USDT (TRC20) uses 6 decimal places on chain ("Sun" for TRC20). The LEDGER,
// however, stores `wallets.usdt_balance_cents` — 2 decimal places. NEW-6: those
// two scales must never be derived from the same float independently, or the
// chain can receive more than the ledger debited.
export const USDT_DECIMALS = 6;
/** Decimal places of the ledger unit (`usdt_balance_cents`). */
export const USDT_LEDGER_DECIMALS = 2;

/**
 * Raw 6-dp conversion from a USDT amount to on-chain minor units.
 *
 * NOTE: this is a unit-conversion helper only. It is deliberately NOT used to
 * size a payout — see `centsToUsdtMinorUnits`, which derives the chain amount
 * from the same integer that was debited.
 *
 * (A previous comment here claimed `0.29 * 1e6 === 289999.9999999999`. That is
 * factually wrong: it evaluates to exactly 290000 in IEEE-754 double precision,
 * so the Math.floor -> Math.round change it justified was a no-op for every
 * value its own test exercised. The real defect was the debit/send scale
 * mismatch, fixed below.)
 */
export function toUsdtMinorUnits(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0) return 0;
    return Math.round(amount * 10 ** USDT_DECIMALS);
}

/**
 * The single canonical scaling from ledger cents to on-chain minor units.
 *
 * Pure integer arithmetic (cents * 10^4), so there is no binary-float step and
 * the chain amount is exactly the debited amount. Fail-safe: returns 0 for
 * anything that is not a non-negative integer number of cents.
 */
export function centsToUsdtMinorUnits(cents: number): number {
    if (!Number.isInteger(cents) || cents < 0) return 0;
    return cents * 10 ** (USDT_DECIMALS - USDT_LEDGER_DECIMALS);
}

/**
 * Largest ledger amount (in cents) we accept. Scaling this to 6 dp must stay
 * inside Number.MAX_SAFE_INTEGER so no conversion can silently lose precision.
 */
const MAX_USDT_CENTS = Math.floor(
    Number.MAX_SAFE_INTEGER / 10 ** (USDT_DECIMALS - USDT_LEDGER_DECIMALS),
);

/**
 * Parse a caller-supplied USDT amount into the canonical integer ledger unit
 * (cents), or null if it is not representable.
 *
 * Strict by design — it REJECTS rather than truncates, because silently
 * truncating a sub-cent amount is exactly what let the chain be sent more than
 * the ledger recorded:
 *  - at most `USDT_LEDGER_DECIMALS` (2) decimal places
 *  - plain decimal notation only (no exponent form, no hex, no thousands
 *    separators)
 *  - finite, non-negative, within MAX_USDT_CENTS
 *
 * Parsing is done on the DIGIT STRING, not via float multiplication, so no
 * rounding decision is ever made.
 */
export function parseUsdtAmountToCents(input: unknown): number | null {
    let text: string;
    if (typeof input === 'number') {
        if (!Number.isFinite(input) || input < 0) return null;
        // Render without exponent notation so the digit-string path below can
        // reject sub-cent precision instead of rounding it away.
        text = input.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
    } else if (typeof input === 'string') {
        text = input.trim();
    } else {
        return null;
    }

    // Plain decimal only: optional integer part, optional fraction of 1-2 digits.
    const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
    if (!m) return null;

    const whole = m[1];
    const frac = (m[2] ?? '').padEnd(USDT_LEDGER_DECIMALS, '0');

    // Integer maths on the digit string: no float multiplication, no rounding.
    const cents = Number(whole) * 10 ** USDT_LEDGER_DECIMALS + Number(frac);
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_USDT_CENTS) return null;
    return cents;
}

interface CryptoPayoutRequest {
    userId: string;
    amount: number; // Amount in USDT (display/logging only)
    /**
     * NEW-6: the canonical integer ledger amount, in USDT cents, that was
     * ACTUALLY debited. The on-chain send is derived from this and never from
     * `amount`, so the chain can never receive more than the ledger recorded.
     * Optional for backwards compatibility; when absent it is derived from
     * `amount` via the strict parser and an unrepresentable amount is refused
     * pre-broadcast.
     */
    amountCents?: number;
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
    outcome: PayoutOutcome;
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
 * NEW-6: resolve the canonical integer ledger amount (USDT cents) for a payout.
 * Prefers the explicit `amountCents` supplied by the caller (which is the exact
 * value debited from the wallet); otherwise derives it strictly from `amount`.
 * Returns null when the amount is not representable in the ledger unit, which
 * callers MUST treat as a pre-broadcast refusal.
 */
function resolvePayoutCents(request: CryptoPayoutRequest): number | null {
    if (request.amountCents !== undefined) {
        return Number.isInteger(request.amountCents) && request.amountCents >= 0
            ? request.amountCents
            : null;
    }
    return parseUsdtAmountToCents(request.amount);
}

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
                outcome: 'not_sent',
                error: `Minimum crypto payout amount is ${MIN_CRYPTO_PAYOUT_AMOUNT} USDT`
            };
        }

        // NEW-6: the amount must be exactly representable in the ledger unit
        // (2 dp). Refusing here — strictly before any broadcast — is what stops a
        // sub-cent amount reaching the chain and over-sending relative to the
        // debit. 'not_sent' is accurate: nothing has left custody.
        if (resolvePayoutCents(request) === null) {
            logger.warn('Crypto payout refused: amount not representable in ledger units', {
                userId: request.userId, amount: request.amount, amountCents: request.amountCents,
            });
            return {
                success: false,
                status: 'failed',
                outcome: 'not_sent',
                error: 'Amount must have at most 2 decimal places',
            };
        }

        // Validate wallet address
        if (!isValidCryptoAddress(request.walletAddress, request.network)) {
            return {
                success: false,
                status: 'failed',
                outcome: 'not_sent',
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

        // Fail-closed: an unexpected throw escaping a provider call means we
        // cannot prove the broadcast never happened. Treat as ambiguous so the
        // withdrawal service holds for reconciliation instead of refunding.
        return {
            success: false,
            status: 'failed',
            outcome: 'unknown',
            error: error.message || 'Failed to process crypto payout'
        };
    }
}

/**
 * Binance Pay integration
 */
async function sendViaBinancePay(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        return {
            success: false,
            status: 'failed',
            outcome: 'not_sent',
            error: 'Binance API credentials not configured'
        };
    }

    logger.error('Binance Pay payout not implemented - rejecting request', { amount: request.amount, userId: request.userId });

    return {
        success: false,
        status: 'failed',
        outcome: 'not_sent',
        error: 'Binance Pay integration is not yet available. Please use manual processing.'
    };
}

/**
 * Coinbase Commerce integration
 */
async function sendViaCoinbaseCommerce(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    if (!COINBASE_API_KEY) {
        return {
            success: false,
            status: 'failed',
            outcome: 'not_sent',
            error: 'Coinbase Commerce API key not configured'
        };
    }

    logger.error('Coinbase Commerce payout not implemented - rejecting request', { amount: request.amount, userId: request.userId });

    return {
        success: false,
        status: 'failed',
        outcome: 'not_sent',
        error: 'Coinbase Commerce integration is not yet available. Please use manual processing.'
    };
}

/**
 * Circle (USDC) integration
 */
async function sendViaCircle(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    if (!CIRCLE_API_KEY) {
        return {
            success: false,
            status: 'failed',
            outcome: 'not_sent',
            error: 'Circle API key not configured'
        };
    }

    logger.error('Circle payout not implemented - rejecting request', { amount: request.amount, userId: request.userId });

    return {
        success: false,
        status: 'failed',
        outcome: 'not_sent',
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
            outcome: 'not_sent',
            error: 'TronGrid only supports TRC20. Use manual for other networks.'
        };
    }
    if (!TRON_HOT_WALLET_PRIVATE_KEY) {
        logger.warn('TronGrid: TRON_HOT_WALLET_PRIVATE_KEY not set, falling back to manual');
        return await createManualPayoutRequest(request);
    }

    // Phase 1 — setup AND transaction build, strictly BEFORE any broadcast.
    // TronWeb's contract.transfer(...) only builds the method object (no
    // network I/O); the broadcast happens in .send(). A failure anywhere in
    // this phase therefore cannot have moved funds, so it is 'not_sent' (safe
    // to refund upstream).
    let tronWeb: any;
    let contract: any;
    let method: any;
    let amountSun: number;
    try {
        const { TronWeb } = await import('tronweb' as any);
        tronWeb = new TronWeb({
            fullHost: TRONGRID_BASE,
            headers: TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {}
        });
        tronWeb.setPrivateKey(TRON_HOT_WALLET_PRIVATE_KEY);
        // NEW-6: derive the chain amount from the SAME integer that was debited
        // from the ledger, using pure integer scaling. Deriving it independently
        // from the float `request.amount` is what let the chain receive up to
        // ~0.005 USDT more than the wallet was debited.
        const payoutCents = resolvePayoutCents(request);
        if (payoutCents === null) {
            throw new Error('Amount must have at most 2 decimal places');
        }
        amountSun = centsToUsdtMinorUnits(payoutCents);
        contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
        method = contract.transfer(request.walletAddress, amountSun);
    } catch (setupError: any) {
        logger.error('TronGrid payout setup failed (pre-broadcast)', { error: setupError.message, amount: request.amount });
        return {
            success: false,
            status: 'failed',
            outcome: 'not_sent',
            error: setupError.message || 'TronGrid setup failed'
        };
    }

    // Phase 2 — the broadcast itself. From the moment .send() is invoked we can
    // no longer prove the transaction did NOT go out: a thrown error or a lost
    // response is AMBIGUOUS, not a definite failure.
    let tx: any;
    try {
        tx = await method.send();
    } catch (sendError: any) {
        logger.error('TronGrid broadcast threw — outcome UNKNOWN, must reconcile', { error: sendError.message, amount: request.amount });
        return {
            success: false,
            status: 'failed',
            outcome: 'unknown',
            error: sendError.message || 'TronGrid transfer failed after broadcast attempt'
        };
    }

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
            outcome: 'confirmed_sent',
            estimatedCompletionTime: '1-2 minutes'
        };
    }

    // Broadcast returned but with an unrecognized shape: we cannot confirm it
    // succeeded OR that it failed. Ambiguous → never auto-refund.
    logger.error('TronGrid returned no recognizable tx id — outcome UNKNOWN, must reconcile', { amount: request.amount });
    return {
        success: false,
        status: 'failed',
        outcome: 'unknown',
        error: 'No transaction ID returned'
    };
}

/**
 * No automated payout mechanism is available (provider is 'manual', or a
 * configured provider is missing the credential it needs to broadcast).
 *
 * NEW-7: this used to return `{ success: true, status: 'pending', outcome:
 * 'not_sent' }` alongside a comment promising "Store in pending_crypto_payouts
 * table (admin will process)". That table does not exist and there was no
 * INSERT — nothing was persisted, so no admin could ever process it. The
 * response therefore reported a queued payout that did not exist, and its
 * `success: true` contradicted its own `not_sent` outcome.
 *
 * It is now honestly fail-closed: failure, with `outcome: 'not_sent'` because we
 * KNOW nothing was broadcast. The withdrawal service reads the outcome, refunds
 * the user (safe — no funds left custody and nothing is queued) and rejects the
 * request, so the caller is never left debited against a payout nobody will make.
 *
 * IF a real manual-payout queue is implemented later, it MUST go through the
 * held-withdrawal lifecycle (`status = 'held'`, `asset_type = 'usdt'`, resolved
 * by the admin USDT settle/refund endpoints) rather than being bolted on here.
 * Persisting a queue row while still returning 'not_sent' would let an operator
 * pay out a withdrawal that this path had already caused to be refunded and
 * rejected — a double payout.
 */
async function createManualPayoutRequest(request: CryptoPayoutRequest): Promise<CryptoPayoutResponse> {
    logger.warn('Crypto payout unavailable: no automated provider configured (fail-closed, no payout queued)', {
        userId: request.userId,
        amount: request.amount,
        address: request.walletAddress.substring(0, 6) + '...' + request.walletAddress.substring(request.walletAddress.length - 4),
        network: request.network,
        provider: CRYPTO_PROVIDER,
    });

    return {
        success: false,
        status: 'failed',
        outcome: 'not_sent',
        error: 'No automated crypto payout provider is configured; manual payout is not implemented',
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
