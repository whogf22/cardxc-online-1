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

/**
 * Compute the number of block confirmations for a TRC-20 transaction by
 * comparing the transaction's block height to the current chain head, using the
 * TRON full-node HTTP API (proxied by TronGrid): `gettransactioninfobyid`
 * returns `blockNumber`; `getnowblock` returns the head block number.
 *
 * SECURITY (fail-closed): any error, missing block number, or unreachable API
 * yields 0 confirmations, so an on-chain deposit is never credited on
 * incomplete/unknown confirmation data.
 */
export async function getConfirmations(txHash: string): Promise<number> {
    try {
        const infoRes = await fetch(`${TRONGRID_BASE}/wallet/gettransactioninfobyid`, {
            method: 'POST',
            headers: { ...getTronGridHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: txHash }),
        });
        if (!infoRes.ok) return 0;
        const info = await infoRes.json() as { blockNumber?: number };
        const txBlock = Number(info?.blockNumber || 0);
        if (!txBlock) return 0;

        const nowRes = await fetch(`${TRONGRID_BASE}/wallet/getnowblock`, {
            method: 'POST',
            headers: { ...getTronGridHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (!nowRes.ok) return 0;
        const now = await nowRes.json() as { block_header?: { raw_data?: { number?: number } } };
        const headBlock = Number(now?.block_header?.raw_data?.number || 0);
        if (!headBlock || headBlock < txBlock) return 0;

        return headBlock - txBlock + 1;
    } catch (err: any) {
        logger.warn('[DepositMonitor] getConfirmations failed (treating as 0 — fail closed)', { error: err?.message });
        return 0;
    }
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
        // First, mature any previously-seen deposits that were under-confirmed.
        await recheckPendingDeposits();

        const minTimestamp = lastCheckedTimestamp || (Date.now() - 24 * 60 * 60 * 1000);

        const url = `${TRONGRID_BASE}/v1/accounts/${DEPOSIT_ADDRESS}/transactions/trc20?only_to=true&limit=50&min_timestamp=${minTimestamp}&contract_address=${USDT_TRC20_CONTRACT}`;

        const response = await fetch(url, { headers: getTronGridHeaders() });

        if (!response.ok) {
            logger.error('[DepositMonitor] TronGrid API error', { status: response.status });
            return;
        }

        const data = await response.json() as { data?: any[] };
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

/**
 * Re-check deposits that were seen on-chain but had not yet reached the required
 * confirmation count. Credits each one only once its confirmations mature. The
 * transfers-list endpoint is time-windowed and won't re-return an already-seen
 * tx, so this pass is what eventually credits a slow-to-confirm deposit.
 */
async function recheckPendingDeposits(): Promise<void> {
    const maturing = await query<{ id: string; user_id: string; tx_hash: string; amount: string; from_address: string }>(
        `SELECT id, user_id, tx_hash, amount, from_address
         FROM crypto_transactions
         WHERE type = 'deposit' AND status = 'pending' AND tx_hash IS NOT NULL
           AND user_id IS NOT NULL AND currency = 'USDT' AND network = 'TRC20'
         ORDER BY created_at ASC LIMIT 50`
    );
    for (const row of maturing) {
        try {
            const confirmations = await getConfirmations(row.tx_hash);
            if (confirmations >= REQUIRED_CONFIRMATIONS) {
                await creditUserDeposit(row.user_id, row.id, row.tx_hash, Number(row.amount), row.from_address, Date.now(), confirmations);
            } else {
                await query(
                    `UPDATE crypto_transactions SET confirmations = $1, updated_at = NOW() WHERE id = $2 AND status = 'pending'`,
                    [confirmations, row.id]
                );
            }
        } catch (err: any) {
            logger.error('[DepositMonitor] recheck error', { id: row.id, error: err?.message });
        }
    }
}

export async function processIncomingTransaction(tx: any): Promise<void> {
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
    if (existing) return; // already tracked; maturity handled by recheckPendingDeposits

    const pendingDeposit = await queryOne<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM crypto_transactions 
         WHERE type = 'deposit' AND status = 'pending' AND tx_hash IS NULL
         AND from_address = $1 AND currency = 'USDT' AND network = 'TRC20'
         ORDER BY created_at DESC LIMIT 1`,
        [fromAddress]
    );

    const blockTimestamp = tx.block_timestamp || Date.now();

    // Confirmation gate (fail-closed): never credit until the deposit has at
    // least REQUIRED_CONFIRMATIONS on-chain confirmations.
    const confirmations = await getConfirmations(txHash);

    if (pendingDeposit) {
        if (confirmations >= REQUIRED_CONFIRMATIONS) {
            await creditUserDeposit(pendingDeposit.user_id, pendingDeposit.id, txHash, amount, fromAddress, blockTimestamp, confirmations);
        } else {
            // Link the on-chain tx to the pending intent and record progress, but
            // DO NOT credit. recheckPendingDeposits credits it once matured.
            await query(
                `UPDATE crypto_transactions
                 SET tx_hash = $1, amount = $2, from_address = $3, confirmations = $4, updated_at = NOW()
                 WHERE id = $5 AND status = 'pending'`,
                [txHash, amount, fromAddress, confirmations, pendingDeposit.id]
            );
            logger.info('[DepositMonitor] Deposit under-confirmed, awaiting confirmations', { txHash, confirmations, required: REQUIRED_CONFIRMATIONS });
        }
    } else {
        // No matching user intent. Record for reconciliation; only mark completed
        // when actually confirmed, otherwise keep it as processing.
        const status = confirmations >= REQUIRED_CONFIRMATIONS ? 'completed' : 'processing';
        const unclaimedResult = await query(
            `INSERT INTO crypto_transactions (
                type, status, amount, currency, network, tx_hash, 
                from_address, to_address, confirmations, required_confirmations
            ) VALUES ('deposit', $7, $1, 'USDT', 'TRC20', $2, $3, $4, $5, $6)
            RETURNING id`,
            [amount, txHash, fromAddress, DEPOSIT_ADDRESS, confirmations, REQUIRED_CONFIRMATIONS, status]
        );
        logger.info('[DepositMonitor] Unclaimed deposit recorded', { 
            txHash, amount, from: fromAddress, status, confirmations, id: unclaimedResult[0]?.id 
        });
    }
}

export async function creditUserDeposit(
    userId: string, cryptoTxId: string, txHash: string, 
    amount: number, fromAddress: string, blockTimestamp: number,
    confirmations: number = REQUIRED_CONFIRMATIONS
): Promise<void> {
    const amountCents = Math.round(amount * 100);

    try {
        await transaction(async (client) => {
        // Atomically claim the pending deposit. Only the run that flips the row
        // out of 'pending' proceeds to credit the wallet; a concurrent monitor
        // pass (or a second server instance) that loses the race gets rowCount
        // 0 and aborts before any credit, preventing a double-credit. The bare
        // tx_hash SELECT above is only a fast-path dedup and is not race-safe on
        // its own (pending rows carry a NULL tx_hash and there is no lock).
        const claim = await client.query(
            `UPDATE crypto_transactions 
             SET status = 'completed', tx_hash = $1, amount = $2, 
                 from_address = $3, confirmations = $4, confirmed_at = NOW(), updated_at = NOW()
             WHERE id = $5 AND status = 'pending'`,
            [txHash, amount, fromAddress, confirmations, cryptoTxId]
        );

        if (claim.rowCount === 0) {
            throw new Error('DEPOSIT_ALREADY_CREDITED');
        }

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
    } catch (err: any) {
        if (err?.message === 'DEPOSIT_ALREADY_CREDITED') {
            // Benign: another monitor pass already claimed and credited this
            // deposit. Nothing to do and nothing was charged twice.
            logger.info('[DepositMonitor] Deposit already credited, skipping', { cryptoTxId, txHash });
            return;
        }
        throw err;
    }

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
        const data = await response.json() as { data?: any[] };
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
