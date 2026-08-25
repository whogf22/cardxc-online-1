/**
 * Unified Withdrawal Service
 * Handles 3 types of withdrawals:
 * 1. Bank Transfer
 * 2. Crypto Transfer (USDT TRC20)
 * 3. Platform User Transfer
 */

import { query, queryOne, transaction } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';
import { createAuditLog } from './auditService';
import { sendCryptoToWallet } from './cryptoProviderService';
import { runFraudChecks } from './fraudService';

export type WithdrawalType = 'bank' | 'crypto' | 'platform';
export type WalletType = 'fiat' | 'usdt';

/**
 * Unified result shape for every withdrawal path. Individual paths populate the
 * subset of optional fields relevant to them (e.g. crypto sets `status` /
 * `requiresReconciliation`; platform sets `recipient`). A single declared type
 * keeps callers and tests from having to narrow a large structural union.
 */
export interface WithdrawalResult {
    success: boolean;
    message: string;
    withdrawalId?: string;
    payoutId?: string;
    txHash?: string | null;
    status?: string;
    estimatedTime?: string;
    idempotent?: boolean;
    requiresReview?: boolean;
    requiresReconciliation?: boolean;
    recipient?: { email: string; name: string | null };
}

interface BankWithdrawalRequest {
    type: 'bank';
    userId: string;
    amount: number;
    currency: string;
    walletType: WalletType;
    bankName: string;
    accountNumber: string;
    accountName: string;
    idempotencyKey?: string;
}

interface CryptoWithdrawalRequest {
    type: 'crypto';
    userId: string;
    amount: number; // Amount in USDT
    walletAddress: string;
    network: string; // TRC20, ERC20, etc.
    idempotencyKey?: string;
}

interface PlatformWithdrawalRequest {
    type: 'platform';
    userId: string;
    recipientEmail: string;
    amount: number;
    walletType: WalletType;
    message?: string;
    idempotencyKey?: string;
}

type WithdrawalRequest = BankWithdrawalRequest | CryptoWithdrawalRequest | PlatformWithdrawalRequest;

/**
 * Process withdrawal request based on type
 */
export async function processWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResult> {
    switch (request.type) {
        case 'bank':
            return await processBankWithdrawal(request);

        case 'crypto':
            return await processCryptoWithdrawal(request);

        case 'platform':
            return await processPlatformTransfer(request);

        default:
            throw new AppError('Invalid withdrawal type', 400);
    }
}

/**
 * 1. Bank Transfer Withdrawal
 */
async function processBankWithdrawal(request: BankWithdrawalRequest) {
    const amountCents = Math.round(request.amount * 100);

    return await transaction(async (client) => {
        // Check balance
        const wallet = await client.query(`
      SELECT balance_cents, usdt_balance_cents, reserved_cents 
      FROM wallets 
      WHERE user_id = $1 AND currency = $2 
      FOR UPDATE
    `, [request.userId, request.currency]);

        if (!wallet.rows[0]) {
            throw new AppError('Wallet not found', 404);
        }

        let available: number;

        if (request.walletType === 'usdt') {
            available = Number(wallet.rows[0].usdt_balance_cents || 0);
            if (available < amountCents) {
                throw new AppError('Insufficient USDT balance', 400);
            }

            // Deduct from USDT balance (guarded: rowCount 0 aborts the withdrawal
            // rather than letting a concurrent debit overdraw the wallet)
            const usdtWithdrawDebit = await client.query(`
        UPDATE wallets
        SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3 AND usdt_balance_cents >= $1
      `, [amountCents, request.userId, request.currency]);
            if (usdtWithdrawDebit.rowCount === 0) {
                throw new AppError('Insufficient USDT balance', 400);
            }

        } else {
            available = Number(wallet.rows[0].balance_cents) - Number(wallet.rows[0].reserved_cents);
            if (available < amountCents) {
                throw new AppError('Insufficient balance', 400);
            }

            // Reserve fiat balance
            await client.query(`
        UPDATE wallets 
        SET reserved_cents = reserved_cents + $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [amountCents, request.userId, request.currency]);
        }

        // Create withdrawal request
        const withdrawalResult = await client.query(`
      INSERT INTO withdrawal_requests (
        user_id, amount_cents, currency, withdrawal_type,
        bank_name, account_number, account_name, status
      )
      VALUES ($1, $2, $3, 'bank', $4, $5, $6, 'pending')
      RETURNING id
    `, [
            request.userId, amountCents, request.currency,
            request.bankName, request.accountNumber, request.accountName
        ]);

        // Create transaction record
        await client.query(`
      INSERT INTO transactions (
        user_id, type, status, amount_cents, currency, 
        reference, description
      )
      VALUES ($1, 'withdrawal', 'PENDING', $2, $3, $4, $5)
    `, [
            request.userId, amountCents, request.currency,
            withdrawalResult.rows[0].id,
            `Bank withdrawal to ${request.bankName}`
        ]);

        await createAuditLog({
            userId: request.userId,
            action: 'BANK_WITHDRAWAL_REQUESTED',
            entityType: 'withdrawal_request',
            entityId: withdrawalResult.rows[0].id,
            newValues: {
                amount: request.amount,
                walletType: request.walletType,
                bank: request.bankName
            }
        });

        logger.info('Bank withdrawal requested', {
            userId: request.userId,
            amount: request.amount,
            walletType: request.walletType
        });

        return {
            success: true,
            withdrawalId: withdrawalResult.rows[0].id,
            message: 'Withdrawal request submitted. Admin will process within 24 hours.',
            estimatedTime: '1-3 business days'
        };
    });
}

/**
 * Hold a crypto withdrawal for manual review / reconciliation. The USDT balance
 * has ALREADY been deducted and is intentionally kept deducted (the funds are
 * held, not refunded). This is used both when the control gate blocks an
 * auto-payout (HIGH-3) and when a broadcast outcome is ambiguous (CRITICAL-2).
 */
async function holdForManualReview(withdrawalId: string, request: CryptoWithdrawalRequest, note: string) {
    try {
        await transaction(async (client) => {
            await client.query(`
        UPDATE withdrawal_requests
        SET status = 'processing', admin_notes = $1, updated_at = NOW()
        WHERE id = $2
      `, [note, withdrawalId]);
        });
    } catch (e: any) {
        logger.error('Failed to mark crypto withdrawal for manual review', { withdrawalId, error: e?.message });
    }
    try {
        await createAuditLog({
            userId: request.userId,
            action: 'CRYPTO_WITHDRAWAL_HELD',
            entityType: 'withdrawal_request',
            entityId: withdrawalId,
            newValues: { note, amount: request.amount, network: request.network },
        });
    } catch {
        // Audit logging is best-effort; never let it change the money decision.
    }
}

/**
 * Look up an already-submitted withdrawal by its logical idempotency key so a
 * retry/double-submit returns the prior request instead of moving money twice.
 */
async function findPriorWithdrawal(userId: string, idempotencyKey: string) {
    return await queryOne<{ id: string; status: string; tx_hash: string | null }>(`
    SELECT id, status, tx_hash FROM withdrawal_requests
    WHERE user_id = $1 AND idempotency_key = $2
  `, [userId, idempotencyKey]);
}

/**
 * 2. Crypto Transfer (USDT to external wallet)
 */
async function processCryptoWithdrawal(request: CryptoWithdrawalRequest) {
    const amountCents = Math.round(request.amount * 100);
    const idempotencyKey = request.idempotencyKey?.trim() || null;

    // Minimum amount check
    if (request.amount < 10) {
        throw new AppError('Minimum crypto withdrawal is 10 USDT', 400);
    }

    // HIGH-4: idempotency. If this logical request was already submitted, return
    // the prior withdrawal rather than deducting or broadcasting a second time.
    if (idempotencyKey) {
        const prior = await findPriorWithdrawal(request.userId, idempotencyKey);
        if (prior) {
            return {
                success: true,
                withdrawalId: prior.id,
                txHash: prior.tx_hash || null,
                idempotent: true,
                status: prior.status,
                message: 'Withdrawal already submitted'
            };
        }
    }

    let withdrawalId: string = '';

    // Step 1: Deduct balance and create withdrawal request in a transaction.
    try {
        await transaction(async (client) => {
            // Check USDT balance
            const wallet = await client.query(`
      SELECT usdt_balance_cents
      FROM wallets
      WHERE user_id = $1 AND currency = 'USD'
      FOR UPDATE
    `, [request.userId]);

            const usdtBalance = Number(wallet.rows[0]?.usdt_balance_cents || 0);

            if (usdtBalance < amountCents) {
                throw new AppError('Insufficient USDT balance', 400);
            }

            // Deduct USDT (guarded: rowCount 0 aborts the crypto withdrawal rather
            // than allowing an overdraw under concurrent debits)
            const cryptoUsdtDebit = await client.query(`
      UPDATE wallets
      SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
      WHERE user_id = $2 AND currency = 'USD' AND usdt_balance_cents >= $1
    `, [amountCents, request.userId]);
            if (cryptoUsdtDebit.rowCount === 0) {
                throw new AppError('Insufficient USDT balance', 400);
            }

            // Create withdrawal request with processing status. The idempotency
            // key is persisted so a concurrent duplicate collides on the unique
            // index instead of creating a second debit.
            const withdrawalResult = await client.query(`
      INSERT INTO withdrawal_requests (
        user_id, amount_cents, currency, withdrawal_type,
        crypto_address, crypto_network, status, idempotency_key
      )
      VALUES ($1, $2, 'USD', 'crypto', $3, $4, 'processing', $5)
      RETURNING id
    `, [
                request.userId, amountCents,
                request.walletAddress, request.network, idempotencyKey
            ]);

            withdrawalId = withdrawalResult.rows[0].id;
        });
    } catch (err: any) {
        // Idempotency race: a concurrent duplicate won the unique index. The
        // deduction in THIS transaction was rolled back, so return the prior row.
        if (err?.code === '23505' && idempotencyKey) {
            const prior = await findPriorWithdrawal(request.userId, idempotencyKey);
            if (prior) {
                return {
                    success: true,
                    withdrawalId: prior.id,
                    txHash: prior.tx_hash || null,
                    idempotent: true,
                    status: prior.status,
                    message: 'Withdrawal already submitted'
                };
            }
        }
        throw err;
    }

    // Step 1.5: HIGH-3 control gate. Auto-payout is DEFAULT-OFF. An on-chain
    // broadcast only proceeds when the operator has explicitly enabled it, the
    // amount is within the configured cap, AND the fraud/velocity engine passes.
    // Otherwise the withdrawal is HELD for manual review — the external send is
    // never invoked and the deducted balance is NOT refunded (funds are held,
    // pending an operator decision). This is the fail-closed default: no
    // unattended, uncapped, unscreened crypto payout.
    const autoEnabled = process.env.CRYPTO_AUTO_PAYOUT_ENABLED === 'true';
    const capUsd = Number(process.env.CRYPTO_AUTO_PAYOUT_MAX_USD || '0');
    const capCents = Number.isFinite(capUsd) ? Math.round(capUsd * 100) : 0;

    let holdReason = '';
    if (!autoEnabled) {
        holdReason = 'Automatic crypto payout is disabled; manual review required';
    } else if (capCents <= 0 || amountCents > capCents) {
        holdReason = 'Amount exceeds automatic payout cap; manual review required';
    } else {
        // fraudService works in minor units (cents), matching amountCents.
        const fraud = await runFraudChecks({ userId: request.userId, action: 'WITHDRAWAL', amount: amountCents });
        if (!fraud.passed) {
            holdReason = `Fraud/velocity gate blocked: ${fraud.flags.join(', ') || 'blocked'}`;
        }
    }

    if (holdReason) {
        await holdForManualReview(withdrawalId, request, `MANUAL_REVIEW: ${holdReason}`);
        logger.warn('Crypto withdrawal held for manual review (auto-payout gate)', {
            userId: request.userId, withdrawalId, holdReason
        });
        return {
            success: true,
            withdrawalId,
            status: 'processing',
            requiresReview: true,
            message: 'Withdrawal received and is pending manual review'
        };
    }

    // Step 2: Initiate the external payout and interpret its BROADCAST outcome.
    // CRITICAL-2: the refund decision is driven by `outcome`, never by `success`
    // alone. We refund ONLY when we know the funds never left custody.
    let payoutResult: Awaited<ReturnType<typeof sendCryptoToWallet>>;
    try {
        payoutResult = await sendCryptoToWallet({
            userId: request.userId,
            amount: request.amount,
            walletAddress: request.walletAddress,
            network: request.network as any,
            transactionId: withdrawalId
        });
    } catch (sendErr: any) {
        // A THROW from the payout call is AMBIGUOUS — the broadcast may already
        // have gone out. Never auto-refund; hold for reconciliation.
        logger.error('Crypto payout call threw — holding for reconciliation (NO refund)', {
            userId: request.userId, withdrawalId, error: sendErr?.message
        });
        await holdForManualReview(withdrawalId, request, `RECONCILIATION_REQUIRED: payout call threw (${sendErr?.message || 'unknown error'})`);
        return {
            success: true,
            withdrawalId,
            status: 'processing',
            requiresReconciliation: true,
            message: 'Withdrawal is being verified'
        };
    }

    if (payoutResult.outcome === 'confirmed_sent') {
        // The funds have left our custody. From here on we must NOT refund.
        // Record the successful payout. If bookkeeping fails we log loudly for
        // manual reconciliation but keep the user's balance deducted.
        try {
            await transaction(async (client) => {
                await client.query(`
          UPDATE withdrawal_requests
          SET status = 'processing', admin_notes = $1, tx_hash = $2, updated_at = NOW()
          WHERE id = $3
        `, [`Payout ID: ${payoutResult.payoutId}`, payoutResult.txHash || null, withdrawalId]);

                // Record crypto ledger entry
                await client.query(`
          INSERT INTO crypto_ledger_entries (
            user_id, source_transaction_id, crypto_type,
            amount_cents, exchange_rate, usd_equivalent_cents, description
          )
          VALUES ($1, $2, 'USDT', $3, 1.0, $4, $5)
        `, [
                    request.userId, withdrawalId, -amountCents, -amountCents,
                    `USDT withdrawal to ${request.walletAddress.substring(0, 10)}...`
                ]);
            });
        } catch (bookkeepingError: any) {
            logger.error('Crypto withdrawal payout succeeded but bookkeeping failed - MANUAL RECONCILIATION REQUIRED', {
                userId: request.userId,
                withdrawalId,
                payoutId: payoutResult.payoutId,
                txHash: payoutResult.txHash || null,
                error: bookkeepingError?.message
            });
        }

        await createAuditLog({
            userId: request.userId,
            action: 'CRYPTO_WITHDRAWAL_INITIATED',
            entityType: 'withdrawal_request',
            entityId: withdrawalId,
            newValues: {
                amount: request.amount,
                network: request.network,
                address: request.walletAddress
            }
        });

        logger.info('Crypto withdrawal initiated', {
            userId: request.userId,
            amount: request.amount,
            network: request.network,
            payoutId: payoutResult.payoutId
        });

        return {
            success: true,
            withdrawalId,
            payoutId: payoutResult.payoutId,
            txHash: payoutResult.txHash || null,
            message: 'USDT transfer initiated',
            estimatedTime: payoutResult.estimatedCompletionTime || '1-10 minutes',
            status: payoutResult.status
        };
    }

    if (payoutResult.outcome === 'not_sent') {
        // Definite pre-broadcast failure: the funds never left custody, so it is
        // safe to refund and reject.
        await transaction(async (client) => {
            await client.query(`
        UPDATE wallets
        SET usdt_balance_cents = usdt_balance_cents + $1
        WHERE user_id = $2 AND currency = 'USD'
      `, [amountCents, request.userId]);

            await client.query(`
        UPDATE withdrawal_requests
        SET status = 'rejected', admin_notes = $1
        WHERE id = $2
      `, [payoutResult.error || 'Payout failed before broadcast', withdrawalId]);
        });

        logger.error('Crypto withdrawal failed before broadcast — refunded', {
            userId: request.userId,
            withdrawalId,
            error: payoutResult.error
        });

        throw new AppError('Crypto withdrawal failed: ' + (payoutResult.error || 'payout failed'), 500);
    }

    // outcome === 'unknown' (or unrecognized): AMBIGUOUS. The broadcast may have
    // gone out. NEVER auto-refund — hold for manual reconciliation.
    logger.error('Crypto withdrawal outcome UNKNOWN — holding for reconciliation (NO refund)', {
        userId: request.userId,
        withdrawalId,
        error: payoutResult.error
    });
    await holdForManualReview(withdrawalId, request, `RECONCILIATION_REQUIRED: ambiguous payout outcome (${payoutResult.error || 'no confirmation'})`);
    return {
        success: true,
        withdrawalId,
        status: 'processing',
        requiresReconciliation: true,
        message: 'Withdrawal is being verified'
    };
}

/**
 * 3. Platform User Transfer (Instant P2P)
 */
async function processPlatformTransfer(request: PlatformWithdrawalRequest) {
    const amountCents = Math.round(request.amount * 100);

    return await transaction(async (client) => {
        // Find recipient
        const recipient = await client.query(`
      SELECT id, email, full_name FROM users WHERE email = $1
    `, [request.recipientEmail]);

        if (!recipient.rows[0]) {
            throw new AppError('Recipient not found on platform', 404);
        }

        const recipientId = recipient.rows[0].id;

        if (recipientId === request.userId) {
            throw new AppError('Cannot transfer to yourself', 400);
        }

        // Check sender balance
        const senderWallet = await client.query(`
      SELECT balance_cents, usdt_balance_cents, reserved_cents 
      FROM wallets 
      WHERE user_id = $1 AND currency = 'USD'
      FOR UPDATE
    `, [request.userId]);

        if (!senderWallet.rows[0]) {
            throw new AppError('Wallet not found', 404);
        }

        let available: number;
        const currency = 'USD';

        if (request.walletType === 'usdt') {
            available = Number(senderWallet.rows[0].usdt_balance_cents || 0);
            if (available < amountCents) {
                throw new AppError('Insufficient USDT balance', 400);
            }

            // Deduct from sender USDT (guarded: rowCount 0 aborts the transfer)
            const usdtDebit = await client.query(`
        UPDATE wallets
        SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3 AND usdt_balance_cents >= $1
      `, [amountCents, request.userId, currency]);
            if (usdtDebit.rowCount === 0) {
                throw new AppError('Insufficient USDT balance', 400);
            }

            // Credit recipient USDT
            await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents, usdt_balance_cents)
        VALUES ($1, $2, 0, $3)
        ON CONFLICT (user_id, currency)
        DO UPDATE SET usdt_balance_cents = wallets.usdt_balance_cents + $3, updated_at = NOW()
      `, [recipientId, currency, amountCents]);

        } else {
            available = Number(senderWallet.rows[0].balance_cents) - Number(senderWallet.rows[0].reserved_cents);
            if (available < amountCents) {
                throw new AppError('Insufficient balance', 400);
            }

            // Deduct from sender against AVAILABLE funds (guarded: rowCount 0
            // aborts rather than spending reserved money)
            const fiatDebit = await client.query(`
        UPDATE wallets
        SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3 AND balance_cents - COALESCE(reserved_cents, 0) >= $1
      `, [amountCents, request.userId, currency]);
            if (fiatDebit.rowCount === 0) {
                throw new AppError('Insufficient balance', 400);
            }

            // Credit recipient
            await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency)
        DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
      `, [recipientId, currency, amountCents]);
        }

        // Create transaction records
        const description = `Transfer to ${recipient.rows[0].full_name || request.recipientEmail}${request.message ? `: ${request.message}` : ''}`;

        // Sender transaction
        await client.query(`
      INSERT INTO transactions (
        user_id, type, status, amount_cents, currency, description
      )
      VALUES ($1, 'transfer_out', 'SUCCESS', $2, $3, $4)
    `, [request.userId, amountCents, currency, description]);

        // Recipient transaction
        await client.query(`
      INSERT INTO transactions (
        user_id, type, status, amount_cents, currency, description
      )
      VALUES ($1, 'transfer_in', 'SUCCESS', $2, $3, $4)
    `, [recipientId, amountCents, currency, `Received from user`]);

        await createAuditLog({
            userId: request.userId,
            action: 'PLATFORM_TRANSFER_SENT',
            entityType: 'transaction',
            newValues: {
                amount: request.amount,
                recipient: request.recipientEmail,
                walletType: request.walletType
            }
        });

        logger.info('Platform transfer completed', {
            senderId: request.userId,
            recipientId,
            amount: request.amount,
            walletType: request.walletType
        });

        return {
            success: true,
            message: `Successfully sent ${request.amount} ${request.walletType === 'usdt' ? 'USDT' : 'USD'} to ${recipient.rows[0].full_name || request.recipientEmail}`,
            recipient: {
                email: recipient.rows[0].email,
                name: recipient.rows[0].full_name
            }
        };
    });
}
