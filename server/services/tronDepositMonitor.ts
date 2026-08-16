import crypto from 'crypto';
import { query, queryOne, transaction } from '../db/pool';
import { logger } from '../middleware/logger';

const TRONGRID_BASE = 'https://api.trongrid.io';
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || '';
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const DEPOSIT_ADDRESS = process.env.USDT_TRC20_DEPOSIT_ADDRESS || process.env.TRON_HOT_WALLET_ADDRESS || '';
const REQUIRED_CONFIRMATIONS = 20;

// FIN-1 attribution parameters.
// A deposit intent is valid only for a bounded window, and each active intent is
// assigned a unique per-intent amount discriminator (micro-USDT) so an incoming
// transfer to the shared hot wallet maps to at most one user by exact amount.
const DEPOSIT_INTENT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const AMOUNT_TAG_MAX_MICROS = 999_999; // discriminator range: 0.000001 .. 0.999999 USDT
const INTENT_ALLOC_ATTEMPTS = 8;

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
 * Compute confirmations for a TRC-20 transaction from SOLIDIFIED (irreversible)
 * chain state and verify on-chain execution success, per TRON's deposit-crediting
 * guidance. Uses the Solidity HTTP API (proxied by TronGrid):
 *   - `/walletsolidity/gettransactioninfobyid` → returns `blockNumber` and the
 *     execution `receipt.result`/`result` ONLY once the tx's block is solidified.
 *   - `/walletsolidity/getnowblock` → the latest solidified head block number.
 *
 * A transaction that is not yet solidified is simply absent here (no
 * `blockNumber`), so it counts as 0 confirmations. We additionally require the
 * receipt to report SUCCESS so a reverted/failed transfer is never credited.
 *
 * SECURITY (fail-closed): any error, missing block number, non-SUCCESS/ambiguous
 * execution result, or unreachable API yields 0 confirmations — an on-chain
 * deposit is never credited on incomplete, unconfirmed, or failed data.
 *
 * Refs (retrieved 2026-08-15):
 *  - https://developers.tron.network/reference/solidity-node-http-api-overview
 *  - https://developers.tron.network/docs/exchangewallet-integrate-with-the-tron-network
 *    ("Verify success — call /walletsolidity/gettransactioninfobyid and check
 *     receipt.result == SUCCESS. Skip failed transactions.")
 */
export async function getConfirmations(txHash: string): Promise<number> {
    try {
        const infoRes = await fetch(`${TRONGRID_BASE}/walletsolidity/gettransactioninfobyid`, {
            method: 'POST',
            headers: { ...getTronGridHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: txHash }),
        });
        if (!infoRes.ok) return 0;
        const info = await infoRes.json() as { blockNumber?: number; result?: string; receipt?: { result?: string } };

        // Absent blockNumber => not yet in a solidified (irreversible) block.
        const txBlock = Number(info?.blockNumber || 0);
        if (!txBlock) return 0;

        // Execution must have SUCCEEDED on-chain. A TRC-20 transfer is a contract
        // call, so a successful tx reports receipt.result === 'SUCCESS' (top-level
        // `result` may also be SUCCESS). Any other or absent value fails closed.
        const execResult = info?.receipt?.result ?? info?.result;
        if (execResult !== 'SUCCESS') return 0;

        const nowRes = await fetch(`${TRONGRID_BASE}/walletsolidity/getnowblock`, {
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
    const maturing = await query<{ id: string; user_id: string; tx_hash: string; amount: string; expected_amount: string | null; from_address: string }>(
        `SELECT id, user_id, tx_hash, amount, expected_amount, from_address
         FROM crypto_transactions
         WHERE type = 'deposit' AND status = 'pending' AND tx_hash IS NOT NULL
           AND user_id IS NOT NULL AND currency = 'USDT' AND network = 'TRC20'
         ORDER BY created_at ASC LIMIT 50`
    );
    for (const row of maturing) {
        try {
            const confirmations = await getConfirmations(row.tx_hash);
            if (confirmations >= REQUIRED_CONFIRMATIONS) {
                // Credit the amount this intent was attributed by (expected_amount,
                // which the on-chain transfer matched exactly). Falls back to the
                // recorded amount for legacy rows created before FIN-1.
                const creditAmount = Number(row.expected_amount ?? row.amount);
                await creditUserDeposit(row.user_id, row.id, row.tx_hash, creditAmount, row.from_address, Date.now(), confirmations);
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

/**
 * Record an incoming transfer that cannot be safely attributed to a user (no
 * matching active intent, or an ambiguous multi-intent match). Held as
 * 'processing' with NO owner for manual reconciliation. Never credits a wallet.
 */
async function recordUnattributedDeposit(
    txHash: string, amount: number, fromAddress: string, matches: number,
): Promise<void> {
    const unclaimed = await query<{ id: string }>(
        `INSERT INTO crypto_transactions (
            type, status, amount, currency, network, tx_hash,
            from_address, to_address, confirmations, required_confirmations
        ) VALUES ('deposit', 'processing', $1, 'USDT', 'TRC20', $2, $3, $4, 0, $5)
        RETURNING id`,
        [amount, txHash, fromAddress, DEPOSIT_ADDRESS, REQUIRED_CONFIRMATIONS]
    );
    logger.warn('[DepositMonitor] Unattributed deposit held for reconciliation (no single active intent)', {
        txHash, amount, matches, id: unclaimed[0]?.id,
    });
}

export async function processIncomingTransaction(tx: any): Promise<void> {
    const txHash = tx.transaction_id;
    const toAddress = tx.to;
    const fromAddress = tx.from;
    const tokenInfo = tx.token_info;
    const rawAmount = tx.value;

    if (!txHash || !toAddress || !fromAddress) return;

    // 1. Destination must be OUR deposit address.
    if (toAddress.toLowerCase() !== DEPOSIT_ADDRESS.toLowerCase()) return;

    // 2. Token must be USDT-TRC20. The transfers feed is filtered by contract,
    //    but we re-validate so a mis-scoped or spoofed feed can never credit a
    //    non-USDT (or look-alike) token as USDT. A missing contract fails closed.
    const tokenContract = (tokenInfo?.address || '').toString();
    if (tokenContract.toLowerCase() !== USDT_TRC20_CONTRACT.toLowerCase()) {
        logger.warn('[DepositMonitor] Ignoring transfer: token contract is not USDT-TRC20', { txHash, tokenContract });
        return;
    }

    const decimals = tokenInfo?.decimals ?? 6;
    const amount = Number(rawAmount) / Math.pow(10, decimals);
    if (!Number.isFinite(amount) || amount <= 0) return;

    // 3. Global dedup: a given tx_hash is only ever handled once (the partial
    //    unique index on tx_hash is the hard backstop).
    const existing = await queryOne<{ id: string }>(
        'SELECT id FROM crypto_transactions WHERE tx_hash = $1',
        [txHash]
    );
    if (existing) return; // already tracked; maturity handled by recheckPendingDeposits

    // 4. ATTRIBUTION (fail-closed). Map to a user ONLY via a server-generated,
    //    unique `expected_amount` on an ACTIVE, unexpired pending intent. The
    //    client-supplied sender address is NEVER used to determine ownership.
    //    Require EXACTLY ONE match; 0 (no/expired intent) or >1 (ambiguous) →
    //    credit no one and hold for reconciliation.
    const candidates = await query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM crypto_transactions
         WHERE type = 'deposit' AND status = 'pending' AND tx_hash IS NULL
           AND currency = 'USDT' AND network = 'TRC20'
           AND expected_amount = $1
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [amount]
    );

    if (candidates.length !== 1) {
        await recordUnattributedDeposit(txHash, amount, fromAddress, candidates.length);
        return;
    }

    const intent = candidates[0]!;
    const blockTimestamp = tx.block_timestamp || Date.now();

    // 5. Confirmation/finality gate (fail-closed): never credit until the deposit
    //    has at least REQUIRED_CONFIRMATIONS solidified confirmations.
    const confirmations = await getConfirmations(txHash);

    if (confirmations >= REQUIRED_CONFIRMATIONS) {
        // 6. Credited amount == the validated on-chain amount (which equals the
        //    intent's expected_amount by construction of the exact-amount match).
        await creditUserDeposit(intent.user_id, intent.id, txHash, amount, fromAddress, blockTimestamp, confirmations);
    } else {
        // Link the on-chain tx to the matched intent and record progress, but DO
        // NOT credit. recheckPendingDeposits credits it once matured. Binding the
        // tx_hash here also removes the intent from future attribution queries.
        await query(
            `UPDATE crypto_transactions
             SET tx_hash = $1, from_address = $2, confirmations = $3, updated_at = NOW()
             WHERE id = $4 AND status = 'pending'`,
            [txHash, fromAddress, confirmations, intent.id]
        );
        logger.info('[DepositMonitor] Deposit under-confirmed, awaiting confirmations', { txHash, confirmations, required: REQUIRED_CONFIRMATIONS });
    }
}

export async function creditUserDeposit(
    userId: string, cryptoTxId: string, txHash: string, 
    amount: number, fromAddress: string, blockTimestamp: number,
    confirmations: number = REQUIRED_CONFIRMATIONS
): Promise<void> {
    // Defense-in-depth: even though callers gate on confirmations, this function
    // independently refuses to credit an under-confirmed deposit. A value below
    // the threshold indicates a caller bug or a race and must never move funds.
    if (!Number.isFinite(confirmations) || confirmations < REQUIRED_CONFIRMATIONS) {
        logger.error('[DepositMonitor] Refusing to credit under-confirmed deposit', {
            cryptoTxId, txHash, confirmations, required: REQUIRED_CONFIRMATIONS,
        });
        throw new Error('INSUFFICIENT_CONFIRMATIONS');
    }

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

/**
 * Create a deposit intent with a SERVER-GENERATED, globally-unique
 * `expected_amount` (FIN-1). Because every user deposits to one shared hot
 * wallet, the exact amount is the attribution key, so it must be unique among
 * all active pending intents: we append a random micro-USDT discriminator to the
 * requested base amount and rely on the partial-unique index
 * `uniq_crypto_deposit_expected_amount` to reject collisions, retrying with a
 * fresh discriminator. The caller's `fromAddress` is stored for reference ONLY
 * and never participates in attribution.
 *
 * The user must send EXACTLY `expectedAmount` to be credited.
 */
export async function createDepositIntent(userId: string, amount: number, fromAddress?: string): Promise<{ depositId: string; depositAddress: string; expectedAmount: number; expiresAt: string }> {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('INVALID_DEPOSIT_AMOUNT');
    }
    // Truncate the requested base to whole USDT so the fractional part is
    // reserved entirely for the server's discriminator.
    const base = Math.floor(amount);
    if (base <= 0) {
        throw new Error('INVALID_DEPOSIT_AMOUNT');
    }

    for (let attempt = 0; attempt < INTENT_ALLOC_ATTEMPTS; attempt++) {
        // Cryptographically-random discriminator so it is not guessable/forgeable.
        const tagMicros = crypto.randomInt(1, AMOUNT_TAG_MAX_MICROS + 1);
        const expectedAmount = Number((base + tagMicros / 1_000_000).toFixed(6));
        const expiresAt = new Date(Date.now() + DEPOSIT_INTENT_TTL_MS).toISOString();

        try {
            const result = await query<{ id: string; expires_at: string }>(
                `INSERT INTO crypto_transactions (
                    user_id, type, status, amount, expected_amount, currency, network,
                    to_address, from_address, required_confirmations, expires_at
                ) VALUES ($1, 'deposit', 'pending', $2, $2, 'USDT', 'TRC20', $3, $4, $5, $6)
                RETURNING id, expires_at`,
                [userId, expectedAmount, DEPOSIT_ADDRESS, fromAddress || null, REQUIRED_CONFIRMATIONS, expiresAt]
            );

            return {
                depositId: result[0].id,
                depositAddress: DEPOSIT_ADDRESS,
                expectedAmount,
                expiresAt: result[0].expires_at ?? expiresAt,
            };
        } catch (err: any) {
            // 23505 = unique_violation → this expected_amount is already claimed
            // by another active intent; retry with a new discriminator.
            if (err?.code === '23505') {
                continue;
            }
            throw err;
        }
    }

    logger.error('[DepositMonitor] Could not allocate a unique deposit amount', { userId });
    throw new Error('DEPOSIT_INTENT_ALLOCATION_FAILED');
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
