import { query, queryOne, transaction } from '../db/pool';
import { logger } from '../middleware/logger';

const TRONGRID_BASE = 'https://api.trongrid.io';
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || '';
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const DEPOSIT_ADDRESS = process.env.USDT_TRC20_DEPOSIT_ADDRESS || process.env.TRON_HOT_WALLET_ADDRESS || '';
const REQUIRED_CONFIRMATIONS = 20;

let lastCheckedTimestamp = 0;
let isMonitoring = false;

function getTronGridHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };
    if (TRONGRID_API_KEY) {
        headers['TRON-PRO-API-KEY'] = TRONGRID_API_KEY;
    }
    return headers;
}

export async function checkForNewDeposits(): Promise<void> {
    if (!DEPOSIT_ADDRESS) {
        logger.debug('[DepositMonitor] No deposit address configured, skipping');
        return;
    }

    if (isMonitoring) {
        logger.debug('[DepositMonitor] Already monitoring, skipping');
        return;
    }

    isMonitoring = true;

    try {
        const minTimestamp = lastCheckedTimestamp || (Date.now() - 24 * 60 * 60 * 1000);

        const url = `${TRONGRID_BASE}/v1/accounts/${DEPOSIT_ADDRESS}/transactions/trc20?only_to=true&limit=50&min_timestamp=${minTimestamp}&contract_address=${USDT_TRC20_CONTRACT}`;

        const response = await fetch(url, { headers: getTronGridHeaders() });

        if (!response.ok) {
            logger.error('[DepositMonitor] TronGrid API error', { status: response.status });
            return;
        }

        const data = await response.json();
        const transactions = data?.data || [];

        if (transactions.length === 0) {
            logger.debug('[DepositMonitor] No new deposits found');
            lastCheckedTimestamp = Date.now();
            return;
        }

        logger.info(`[DepositMonitor] Found ${transactions.length} TRC20 transactions to check`);

        for (const tx of transactions) {
            try {
                await processIncomingTransaction(tx);
            } catch (err: any) {
                logger.error('[DepositMonitor] Error processing tx', { txId: tx.transaction_id, error: err.message });
            }
        }

        lastCheckedTimestamp = Date.now();
    } catch (err: any) {
        logger.error('[DepositMonitor] Monitor error', { error: err.message });
    } finally {
        isMonitoring = false;
    }
}

async function processIncomingTransaction(tx: any): Promise<void> {
    const txHash = tx.transaction_id;
    const toAddress = tx.to;
    const fromAddress = tx.from;
    const tokenInfo = tx.token_info;
    const rawAmount = tx.value;

    if (!txHash || !toAddress || !fromAddress) return;

    if (toAddress.toLowerCase() !== DEPOSIT_ADDRESS.toLowerCase()) return;

    const decimals = tokenInfo?.decimals || 6;
    const amount = Number(rawAmount) / Math.pow(10, decimals);

    if (amount <= 0) return;

    const existing = await queryOne<{ id: string }>(
        'SELECT id FROM crypto_transactions WHERE tx_hash = $1',
        [txHash]
    );
    if (existing) return;

    const pendingDeposit = await queryOne<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM crypto_transactions 
         WHERE type = 'deposit' AND status = 'pending' 
         AND from_address = $1 AND currency = 'USDT' AND network = 'TRC20'
         ORDER BY created_at DESC LIMIT 1`,
        [fromAddress]
    );

    const blockTimestamp = tx.block_timestamp || Date.now();

    if (pendingDeposit) {
        await creditUserDeposit(pendingDeposit.user_id, pendingDeposit.id, txHash, amount, fromAddress, blockTimestamp);
    } else {
        const unclaimedResult = await query(
            `INSERT INTO crypto_transactions (
                type, status, amount, currency, network, tx_hash, 
                from_address, to_address, confirmations, required_confirmations
            ) VALUES ('deposit', 'completed', $1, 'USDT', 'TRC20', $2, $3, $4, $5, $6)
            RETURNING id`,
            [amount, txHash, fromAddress, DEPOSIT_ADDRESS, REQUIRED_CONFIRMATIONS, REQUIRED_CONFIRMATIONS]
        );
        logger.info('[DepositMonitor] Unclaimed deposit recorded', { 
            txHash, amount, from: fromAddress, id: unclaimedResult[0]?.id 
        });
    }
}

async function creditUserDeposit(
    userId: string, cryptoTxId: string, txHash: string, 
    amount: number, fromAddress: string, blockTimestamp: number
): Promise<void> {
    const amountCents = Math.round(amount * 100);

    await transaction(async (client) => {
        await client.query(
            `UPDATE crypto_transactions 
             SET status = 'completed', tx_hash = $1, amount = $2, 
                 from_address = $3, confirmations = $4, confirmed_at = NOW(), updated_at = NOW()
             WHERE id = $5`,
            [txHash, amount, fromAddress, REQUIRED_CONFIRMATIONS, cryptoTxId]
        );

        await client.query(
            `INSERT INTO wallets (user_id, currency, balance_cents, usdt_balance_cents)
             VALUES ($1, 'USD', 0, $2)
             ON CONFLICT (user_id, currency)
             DO UPDATE SET usdt_balance_cents = wallets.usdt_balance_cents + $2, updated_at = NOW()`,
            [userId, amountCents]
        );

        await client.query(
            `INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, reference)
             VALUES ($1, 'deposit', 'SUCCESS', $2, 'USD', $3, $4)`,
            [userId, amountCents, `USDT TRC-20 deposit: ${amount} USDT`, txHash]
        );

        await client.query(
            `INSERT INTO crypto_ledger_entries (
                user_id, source_transaction_id, crypto_type, amount_cents, exchange_rate, usd_equivalent_cents, description
            ) VALUES ($1, $2, 'USDT', $3, 1.0, $4, $5)`,
            [userId, cryptoTxId, amountCents, amountCents, `USDT TRC-20 deposit from ${fromAddress.substring(0, 10)}...`]
        );
    });

    logger.info('[DepositMonitor] User credited for deposit', { userId, amount, txHash });
}

export async function createDepositIntent(userId: string, amount: number, fromAddress?: string): Promise<{ depositId: string; depositAddress: string }> {
    const result = await query(
        `INSERT INTO crypto_transactions (
            user_id, type, status, amount, currency, network,
            to_address, from_address, required_confirmations
        ) VALUES ($1, 'deposit', 'pending', $2, 'USDT', 'TRC20', $3, $4, $5)
        RETURNING id`,
        [userId, amount, DEPOSIT_ADDRESS, fromAddress || null, REQUIRED_CONFIRMATIONS]
    );

    return {
        depositId: result[0].id,
        depositAddress: DEPOSIT_ADDRESS
    };
}

export async function getDepositStatus(depositId: string, userId: string): Promise<any> {
    const deposit = await queryOne<any>(
        `SELECT id, status, amount, tx_hash, confirmations, required_confirmations, 
                from_address, to_address, created_at, confirmed_at
         FROM crypto_transactions 
         WHERE id = $1 AND user_id = $2 AND type = 'deposit'`,
        [depositId, userId]
    );

    return deposit || null;
}

export async function getUserCryptoTransactions(userId: string, limit = 20): Promise<any[]> {
    const txs = await query(
        `SELECT id, type, status, amount, currency, network, tx_hash, 
                from_address, to_address, confirmations, required_confirmations,
                fee, created_at, confirmed_at, error_message
         FROM crypto_transactions 
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
    );
    return txs;
}

export async function getTransactionByHash(txHash: string): Promise<any> {
    const url = `${TRONGRID_BASE}/v1/transactions/${txHash}/info`;
    try {
        const response = await fetch(url, { headers: getTronGridHeaders() });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

export async function getWalletBalance(): Promise<{ trx: number; usdt: number } | null> {
    if (!DEPOSIT_ADDRESS) return null;
    try {
        const accountUrl = `${TRONGRID_BASE}/v1/accounts/${DEPOSIT_ADDRESS}`;
        const response = await fetch(accountUrl, { headers: getTronGridHeaders() });
        if (!response.ok) return null;
        const data = await response.json();
        const account = data?.data?.[0];
        if (!account) return null;

        const trxBalance = (account.balance || 0) / 1e6;

        let usdtBalance = 0;
        const trc20Tokens = account.trc20 || [];
        for (const token of trc20Tokens) {
            if (token[USDT_TRC20_CONTRACT]) {
                usdtBalance = Number(token[USDT_TRC20_CONTRACT]) / 1e6;
                break;
            }
        }

        return { trx: trxBalance, usdt: usdtBalance };
    } catch (err: any) {
        logger.error('[DepositMonitor] Failed to get wallet balance', { error: err.message });
        return null;
    }
}
