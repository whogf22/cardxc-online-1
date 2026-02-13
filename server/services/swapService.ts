/**
 * Swap Service
 * Handles currency/crypto swapping with real-time rates and wallet updates
 */

import { query, queryOne, transaction } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';
import { createAuditLog } from './auditService';

export interface SwapRequest {
    userId: string;
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    slippage?: number; // Max acceptable slippage (default 0.5%)
}

export interface SwapQuote {
    fromCurrency: string;
    toCurrency: string;
    fromAmount: number;
    toAmount: number;
    rate: number;
    fee: number;
    feePercentage: number;
    priceImpact: number;
    minimumReceived: number;
    validUntil: number; //timestamp
}

const SWAP_FEE_PERCENTAGE = 0.003; // 0.3%
const DEFAULT_SLIPPAGE = 0.005; // 0.5%
const QUOTE_VALID_DURATION = 30 * 1000; // 30 seconds

// Real-time exchange rate cache
let exchangeRateCache: Record<string, number> = {};
let lastRateFetch = 0;
let consecutiveFailures = 0;
let lastAlertSent = 0;
const RATE_CACHE_DURATION = 60 * 1000; // 1 minute
const MAX_FAILURES_BEFORE_ALERT = 5;
const ALERT_COOLDOWN = 60 * 60 * 1000; // 1 hour

/**
 * Fetch real-time exchange rates from external API
 */
async function fetchExchangeRates(): Promise<Record<string, number>> {
    const now = Date.now();

    // Return cached rates if fresh
    if (now - lastRateFetch < RATE_CACHE_DURATION && Object.keys(exchangeRateCache).length > 0) {
        return exchangeRateCache;
    }

    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();

        // Also fetch crypto rates
        const cryptoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,tether&vs_currencies=usd');
        const cryptoData = await cryptoResponse.json();

        exchangeRateCache = {
            // Fiat rates (already relative to USD)
            'EUR': data.rates.EUR || 0.92,
            'GBP': data.rates.GBP || 0.79,
            'NGN': data.rates.NGN || 1540,

            // Crypto rates (USD per 1 crypto)
            'BTC': cryptoData.bitcoin?.usd || 43000,
            'ETH': cryptoData.ethereum?.usd || 2300,
            'BNB': cryptoData.binancecoin?.usd || 300,
            'USDT': 1.0, // Stablecoin pegged to USD
        };

        lastRateFetch = now;
        consecutiveFailures = 0; // Reset failure count on success

        logger.info('Exchange rates fetched', { rates: exchangeRateCache });

        return exchangeRateCache;
    } catch (error: any) {
        consecutiveFailures++;
        logger.error('Failed to fetch exchange rates', { 
            error: error.message, 
            consecutiveFailures,
            cacheAge: now - lastRateFetch
        });

        // Alert admins if failures exceed threshold and cooldown has passed
        const timeSinceLastAlert = now - lastAlertSent;
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT && timeSinceLastAlert > ALERT_COOLDOWN) {
            logger.error('CRITICAL: Exchange rate API failing consistently', {
                consecutiveFailures,
                cacheAge: now - lastRateFetch,
                message: 'System is using stale/fallback exchange rates'
            });
            lastAlertSent = now;
            // Note: Add admin email notification here if needed
        }

        // Fallback to last cached rates or defaults
        if (Object.keys(exchangeRateCache).length > 0) {
            logger.warn('Using cached exchange rates due to API failure', {
                cacheAge: now - lastRateFetch
            });
            return exchangeRateCache;
        }

        // Emergency fallback rates
        logger.warn('Using emergency fallback exchange rates');
        return {
            'EUR': 0.92,
            'GBP': 0.79,
            'NGN': 1540,
            'BTC': 43000,
            'ETH': 2300,
            'BNB': 300,
            'USDT': 1.0,
        };
    }
}

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
    if (from === to) return 1.0;

    const rates = await fetchExchangeRates();

    // Both are USD
    if (from === 'USD' && to === 'USD') return 1.0;

    // From USD to another currency
    if (from === 'USD') {
        const rate = rates[to];
        if (!rate) throw new AppError(`Exchange rate not available for ${to}`, 400);

        // For crypto, rate is USD per 1 crypto, so we need inverse for USD -> crypto
        if (['BTC', 'ETH', 'BNB', 'USDT'].includes(to)) {
            return 1 / rate;
        }
        return rate;
    }

    // To USD from another currency
    if (to === 'USD') {
        const rate = rates[from];
        if (!rate) throw new AppError(`Exchange rate not available for ${from}`, 400);

        // For crypto, rate is already USD per 1 crypto
        if (['BTC', 'ETH', 'BNB', 'USDT'].includes(from)) {
            return rate;
        }
        return 1 / rate;
    }

    // Cross-currency conversion via USD
    const fromToUSD = await getExchangeRate(from, 'USD');
    const USDtoTo = await getExchangeRate('USD', to);

    return fromToUSD * USDtoTo;
}

/**
 * Get swap quote
 */
export async function getSwapQuote(request: SwapRequest): Promise<SwapQuote> {
    const rate = await getExchangeRate(request.fromCurrency, request.toCurrency);

    const fee = request.amount * SWAP_FEE_PERCENTAGE;
    const amountAfterFee = request.amount - fee;
    const toAmount = amountAfterFee * rate;

    const slippage = request.slippage || DEFAULT_SLIPPAGE;
    const minimumReceived = toAmount * (1 - slippage);

    // Calculate price impact (simplified - actual would depend on liquidity)
    const priceImpact = Math.min((request.amount / 10000) * 0.1, 5); // Max 5%

    return {
        fromCurrency: request.fromCurrency,
        toCurrency: request.toCurrency,
        fromAmount: request.amount,
        toAmount,
        rate,
        fee,
        feePercentage: SWAP_FEE_PERCENTAGE * 100,
        priceImpact,
        minimumReceived,
        validUntil: Date.now() + QUOTE_VALID_DURATION
    };
}

/**
 * Execute swap transaction
 */
export async function executeSwap(request: SwapRequest): Promise<{
    success: boolean;
    swapId: string;
    fromAmount: number;
    toAmount: number;
    rate: number;
}> {
    const quote = await getSwapQuote(request);

    // Validate quote is still valid
    if (Date.now() > quote.validUntil) {
        throw new AppError('Quote expired. Please request a new quote.', 400);
    }

    return await transaction(async (client) => {
        // Check from currency balance
        const balanceField = request.fromCurrency === 'USD' ? 'balance_cents' :
            request.fromCurrency === 'USDT' ? 'usdt_balance_cents' :
                null;

        if (!balanceField) {
            throw new AppError('Currency swaps currently only support USD and USDT', 400);
        }

        const wallet = await client.query(`
      SELECT ${balanceField} as balance
      FROM wallets 
      WHERE user_id = $1 AND currency = 'USD'
      FOR UPDATE
    `, [request.userId]);

        const balance = Number(wallet.rows[0]?.balance || 0) / 100;

        if (balance < request.amount) {
            throw new AppError(`Insufficient ${request.fromCurrency} balance`, 400);
        }

        const amountCents = Math.round(request.amount * 100);
        const toAmountCents = Math.round(quote.toAmount * 100);

        // Deduct from source currency
        if (request.fromCurrency === 'USD') {
            await client.query(`
        UPDATE wallets 
        SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = 'USD'
      `, [amountCents, request.userId]);
        } else if (request.fromCurrency === 'USDT') {
            await client.query(`
        UPDATE wallets 
        SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = 'USD'
      `, [amountCents, request.userId]);
        }

        // Credit to target currency
        if (request.toCurrency === 'USD') {
            await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, 'USD', $2)
        ON CONFLICT (user_id, currency)
        DO UPDATE SET balance_cents = wallets.balance_cents + $2, updated_at = NOW()
      `, [request.userId, toAmountCents]);
        } else if (request.toCurrency === 'USDT') {
            await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents, usdt_balance_cents)
        VALUES ($1, 'USD', 0, $2)
        ON CONFLICT (user_id, currency)
        DO UPDATE SET usdt_balance_cents = wallets.usdt_balance_cents + $2, updated_at = NOW()
      `, [request.userId, toAmountCents]);
        }

        // Record swap transaction
        const swapResult = await client.query(`
      INSERT INTO transactions (
        user_id, type, status, amount_cents, currency,
        description, metadata
      )
      VALUES ($1, 'swap', 'SUCCESS', $2, $3, $4, $5)
      RETURNING id
    `, [
            request.userId, amountCents, request.fromCurrency,
            `Swapped ${request.amount} ${request.fromCurrency} to ${quote.toAmount.toFixed(6)} ${request.toCurrency}`,
            JSON.stringify({
                from: request.fromCurrency,
                to: request.toCurrency,
                fromAmount: request.amount,
                toAmount: quote.toAmount,
                rate: quote.rate,
                fee: quote.fee
            })
        ]);

        const swapId = swapResult.rows[0].id;

        await createAuditLog({
            userId: request.userId,
            action: 'CURRENCY_SWAP',
            entityType: 'transaction',
            entityId: swapId,
            newValues: {
                from: request.fromCurrency,
                to: request.toCurrency,
                amount: request.amount,
                received: quote.toAmount
            }
        });

        logger.info('Swap executed', {
            userId: request.userId,
            from: request.fromCurrency,
            to: request.toCurrency,
            amount: request.amount,
            received: quote.toAmount
        });

        return {
            success: true,
            swapId,
            fromAmount: request.amount,
            toAmount: quote.toAmount,
            rate: quote.rate
        };
    });
}

/**
 * Get user's available balances for swapping
 */
export async function getSwapBalances(userId: string) {
    const wallet = await queryOne(`
    SELECT balance_cents, usdt_balance_cents
    FROM wallets
    WHERE user_id = $1 AND currency = 'USD'
  `, [userId]);

    return {
        USD: {
            balance: Number(wallet?.balance_cents || 0) / 100,
            symbol: 'USD',
            name: 'US Dollar'
        },
        USDT: {
            balance: Number(wallet?.usdt_balance_cents || 0) / 100,
            symbol: 'USDT',
            name: 'Tether USD'
        }
    };
}
