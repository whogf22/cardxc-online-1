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
import { sendCryptoToWallet, parseUsdtAmountToCents } from './cryptoProviderService';
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
async function processBankWithdrawal(request: BankWithdrawalRequest): Promise<WithdrawalResult> {
    const amountCents = Math.round(request.amount * 100);
    const idempotencyKey = request.idempotencyKey?.trim() || null;

    // NEW-8: bank withdrawals honour the same logical idempotency contract as
    // crypto. Previously the key was accepted by the interface and silently
    // discarded, so a double submit created two reserves and two withdrawal rows.
    // This pre-check is only a fast path; the partial unique index on
    // (user_id, idempotency_key) is the authoritative claim (handled below).
    if (idempotencyKey) {
        const prior = await findPriorWithdrawal(request.userId, idempotencyKey);
        if (prior) {
            assertIdempotentPayloadMatches(prior, {
                amountCents, currency: request.currency, withdrawalType: 'bank',
            });
            return {
                success: true,
                withdrawalId: prior.id,
                idempotent: true,
                status: prior.status,
                message: 'Withdrawal already submitted',
            };
        }
    }

    try {
        return await transaction(async (client) => {
        // Check balance
        const wallet = await client.query(`
      SELECT balance_cents, usdt_balance_cents, reserved_cents 
      FROM wallets 
      WHERE user_id = $1 AND currency = $2 
      FOR UPDATE
    `, [request.userId, request.currency]);

        if (!wallet.rows[0]) {
            throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
        }

        let available: number;

        if (request.walletType === 'usdt') {
            available = Number(wallet.rows[0].usdt_balance_cents || 0);
            if (available < amountCents) {
                throw new AppError('Insufficient USDT balance', 400, 'INSUFFICIENT_USDT_BALANCE');
            }

            // Deduct from USDT balance (guarded: rowCount 0 aborts the withdrawal
            // rather than letting a concurrent debit overdraw the wallet)
            const usdtWithdrawDebit = await client.query(`
        UPDATE wallets
        SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3 AND usdt_balance_cents >= $1
      `, [amountCents, request.userId, request.currency]);
            if (usdtWithdrawDebit.rowCount === 0) {
                throw new AppError('Insufficient USDT balance', 400, 'INSUFFICIENT_USDT_BALANCE');
            }

        } else {
            available = Number(wallet.rows[0].balance_cents) - Number(wallet.rows[0].reserved_cents);
            if (available < amountCents) {
                throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
            }

            // Reserve fiat balance. NEW-3: three things matter here.
            //  - COALESCE on the WRITE: `NULL + n` is NULL in Postgres, so
            //    without it a wallet whose reserved_cents IS NULL has its reserve
            //    silently ERASED (and rowCount is still 1, so nothing notices).
            //  - the availability predicate: the JS pre-read above cannot guard
            //    this, both because it runs before the write and because
            //    Number(null) === 0 overstates available funds.
            //  - rowCount === 1: a 0-row result means the reserve was NOT taken,
            //    which must abort the withdrawal instead of creating a request
            //    row backed by nothing. Throwing rolls the transaction back.
            const reserve = await client.query(`
        UPDATE wallets
        SET reserved_cents = COALESCE(reserved_cents, 0) + $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
          AND balance_cents - COALESCE(reserved_cents, 0) >= $1
      `, [amountCents, request.userId, request.currency]);
            if (reserve.rowCount !== 1) {
                throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
            }
        }

        // Create withdrawal request.
        //
        // NEW-1: the lifecycle depends on WHICH asset funded it.
        //  - fiat: the amount is only RESERVED, so the row enters the normal
        //    'pending' admin queue and approve/reject settles the reserve.
        //  - usdt: the amount was debited outright above (there is no USDT
        //    reserve column), so the row is 'held' — funds are already gone and
        //    an operator must explicitly settle or refund it. Routing these into
        //    'pending' is what previously let the fiat approver debit
        //    balance_cents for a withdrawal that had actually taken USDT.
        const assetType = request.walletType === 'usdt' ? 'usdt' : 'fiat';
        const initialStatus = assetType === 'usdt' ? 'held' : 'pending';
        // NEW-8: persist the idempotency key so a concurrent duplicate collides
        // on idx_withdrawal_requests_idempotency_unique instead of creating a
        // second reserve and a second withdrawal row.
        const withdrawalResult = await client.query(`
      INSERT INTO withdrawal_requests (
        user_id, amount_cents, currency, withdrawal_type,
        bank_name, account_number, account_name, status, asset_type, idempotency_key
      )
      VALUES ($1, $2, $3, 'bank', $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
            request.userId, amountCents, request.currency,
            request.bankName, request.accountNumber, request.accountName,
            initialStatus, assetType, idempotencyKey
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
            // R3-3: report the state the row was actually created in. A USDT-funded
            // bank withdrawal enters 'held' (funds already debited, operator must
            // settle or refund), not 'pending'. Callers that echoed a hard-coded
            // 'pending' told the user their USDT withdrawal was queued for the
            // normal fiat approval flow, which is not where it lives.
            status: initialStatus,
            message: 'Withdrawal request submitted. Admin will process within 24 hours.',
            estimatedTime: '1-3 business days'
        };
        });
    } catch (err: any) {
        // NEW-8: idempotency race — a concurrent duplicate won the unique index.
        // The reserve taken in THIS transaction rolled back with it, so return
        // the prior row rather than surfacing a raw 500.
        if (idempotencyKey && isUniqueViolation(err, 'idx_withdrawal_requests_idempotency_unique')) {
            const prior = await findPriorWithdrawal(request.userId, idempotencyKey);
            if (prior) {
                assertIdempotentPayloadMatches(prior, {
                    amountCents, currency: request.currency, withdrawalType: 'bank',
                });
                return {
                    success: true,
                    withdrawalId: prior.id,
                    idempotent: true,
                    status: prior.status,
                    message: 'Withdrawal already submitted',
                };
            }
        }
        throw err;
    }
}

/**
 * Hold a crypto withdrawal for manual review / reconciliation. The USDT balance
 * has ALREADY been deducted and is intentionally kept deducted (the funds are
 * held, not refunded). This is used both when the control gate blocks an
 * auto-payout (HIGH-3) and when a broadcast outcome is ambiguous (CRITICAL-2).
 *
 * The row is left in the explicit 'held' state, which is the ONLY state the
 * admin USDT resolvers accept. Keeping it distinct from 'processing' is what
 * makes a held withdrawal reachable instead of stranded (NEW-1).
 *
 * Returns true when the hold marker was persisted. A false return means the row
 * is still 'held' from creation but carries no reconciliation note, so the caller
 * must surface that rather than reporting a clean hold (NEW-5 sibling).
 */
async function holdForManualReview(withdrawalId: string, request: CryptoWithdrawalRequest, note: string): Promise<boolean> {
    let marked = false;
    try {
        await transaction(async (client) => {
            // R3-2: the write MUST carry the expected prior status. Without
            // `AND status = 'held'` this statement was an unconditional
            // last-writer-wins overwrite: a row an operator had already settled
            // ('sent') or refunded ('rejected') could be dragged back to 'held'
            // by a late reconciliation marker, re-exposing it to a second
            // resolution and a second money movement.
            const res = await client.query(`
        UPDATE withdrawal_requests
        SET status = 'held', admin_notes = $1, updated_at = NOW()
        WHERE id = $2 AND asset_type = 'usdt' AND status = 'held'
      `, [note, withdrawalId]);
            marked = res.rowCount === 1;
        });
    } catch (e: any) {
        logger.error('Failed to mark crypto withdrawal for manual review', { withdrawalId, error: e?.message });
    }
    if (!marked) {
        logger.error('Crypto withdrawal hold marker NOT persisted — reconciliation note missing', { withdrawalId, note });
    }
    try {
        await createAuditLog({
            userId: request.userId,
            action: 'CRYPTO_WITHDRAWAL_HELD',
            entityType: 'withdrawal_request',
            entityId: withdrawalId,
            newValues: { note, amount: request.amount, network: request.network, markerPersisted: marked },
        });
    } catch {
        // Audit logging is best-effort; never let it change the money decision.
    }
    return marked;
}

/**
 * R3-11: persist the OUTCOME of a crypto payout attempt as its own committed
 * transition, claimed from the 'held' state.
 *
 * Two defects motivated this:
 *  1. The confirmed-sent path wrote `status = 'processing'` inside the same
 *     transaction as the ledger insert, with no expected-prior-status predicate,
 *     so a bookkeeping failure rolled the status back too and the row stayed
 *     'held' after a real broadcast — refundable by an operator.
 *  2. The ambiguous / threw paths wrote nothing but a 'held' marker, so a row
 *     whose funds may already be on-chain was indistinguishable from a row that
 *     never reached the provider.
 *
 * `outcome` is a closed internal union, never caller input, so inlining it as a
 * literal is safe; every attacker-influenced value stays parameterised.
 */
async function markSendOutcome(
    withdrawalId: string,
    request: CryptoWithdrawalRequest,
    outcome: 'sent' | 'reconcile',
    note: string,
    txHash: string | null = null,
): Promise<boolean> {
    let marked = false;
    try {
        await transaction(async (client) => {
            const target = outcome === 'sent' ? "'sent'" : "'reconcile'";
            const res = await client.query(`
        UPDATE withdrawal_requests
        SET status = ${target}, admin_notes = $1, tx_hash = COALESCE($2, tx_hash), updated_at = NOW()
        WHERE id = $3 AND asset_type = 'usdt' AND status = 'held'
      `, [note, txHash, withdrawalId]);
            marked = res.rowCount === 1;
        });
    } catch (e: any) {
        logger.error('Failed to persist crypto payout outcome', { withdrawalId, outcome, error: e?.message });
    }
    if (!marked) {
        logger.error('Crypto payout outcome NOT persisted — MANUAL RECONCILIATION REQUIRED', { withdrawalId, outcome, txHash, note });
    }
    try {
        await createAuditLog({
            userId: request.userId,
            action: outcome === 'sent' ? 'CRYPTO_WITHDRAWAL_SENT' : 'CRYPTO_WITHDRAWAL_RECONCILE',
            entityType: 'withdrawal_request',
            entityId: withdrawalId,
            newValues: { note, txHash, amount: request.amount, network: request.network, markerPersisted: marked },
        });
    } catch {
        // Audit logging is best-effort; never let it change the money decision.
    }
    return marked;
}

/**
 * Look up an already-submitted withdrawal by its logical idempotency key so a
 * retry/double-submit returns the prior request instead of moving money twice.
 */
async function findPriorWithdrawal(userId: string, idempotencyKey: string) {
    return await queryOne<{
        id: string; status: string; tx_hash: string | null;
        amount_cents: number | string; currency: string;
        withdrawal_type: string; asset_type: string | null;
    }>(`
    SELECT id, status, tx_hash, amount_cents, currency, withdrawal_type, asset_type
      FROM withdrawal_requests
     WHERE user_id = $1 AND idempotency_key = $2
  `, [userId, idempotencyKey]);
}

/**
 * NEW-8: an idempotency key identifies ONE logical request. Replaying the same
 * key with a DIFFERENT payload is a client bug (or an attempt to have a small
 * prior request stand in for a large new one), so it must be rejected rather
 * than silently returning the prior record.
 *
 * The comparison uses columns the row already carries, so no extra schema is
 * needed.
 */
function assertIdempotentPayloadMatches(
    prior: { amount_cents: number | string; currency: string; withdrawal_type: string },
    expected: { amountCents: number; currency: string; withdrawalType: string },
) {
    const sameAmount = Number(prior.amount_cents) === expected.amountCents;
    const sameCurrency = String(prior.currency) === expected.currency;
    const sameType = String(prior.withdrawal_type) === expected.withdrawalType;
    if (!sameAmount || !sameCurrency || !sameType) {
        throw new AppError(
            'This Idempotency-Key was already used for a different withdrawal request',
            409,
            'IDEMPOTENCY_KEY_CONFLICT',
        );
    }
}

/**
 * Look up a prior platform (P2P) transfer. A platform transfer creates no
 * withdrawal_requests row — it is an instant ledger movement — so its idempotency
 * anchor is the SENDER's transactions row, which carries a UNIQUE
 * idempotency_key (idx_transactions_idempotency_unique).
 */
async function findPriorPlatformTransfer(userId: string, idempotencyKey: string) {
    return await queryOne<{
        id: string; amount_cents: number | string; currency: string; description: string | null;
    }>(`
    SELECT id, amount_cents, currency, description
      FROM transactions
     WHERE user_id = $1 AND idempotency_key = $2
  `, [userId, platformTransferKey(idempotencyKey)]);
}

/** Namespaced ledger key so a platform key cannot collide with another feature. */
function platformTransferKey(idempotencyKey: string): string {
    return `platform_withdrawal_${idempotencyKey}`;
}

/** True when this error is a unique violation on the given constraint name. */
function isUniqueViolation(err: any, constraint?: string): boolean {
    if (err?.code !== '23505') return false;
    if (!constraint) return true;
    const name = String(err?.constraint ?? '');
    if (name) return name === constraint;
    // Some drivers omit `constraint`; fall back to the message.
    return String(err?.message ?? '').includes(constraint);
}

/**
 * 2. Crypto Transfer (USDT to external wallet)
 */
async function processCryptoWithdrawal(request: CryptoWithdrawalRequest) {
    // NEW-6: the ledger unit is 2-dp USDT cents while the chain is 6-dp. Parse
    // ONE canonical integer here and use it for both the debit and the payout, so
    // the chain can never receive more than was debited. Reject rather than
    // truncate a sub-cent amount.
    const parsedCents = parseUsdtAmountToCents(request.amount);
    if (parsedCents === null) {
        throw new AppError('Amount must have at most 2 decimal places', 400);
    }
    const amountCents = parsedCents;
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

            // Create withdrawal request in the explicit 'held' state: the USDT has
            // ALREADY been debited, so the row is awaiting an operator decision
            // (settle or refund) rather than sitting in the fiat 'pending' queue.
            // asset_type records WHICH wallet column funded it so the admin
            // resolvers cannot mutate the wrong asset (NEW-1). The idempotency
            // key is persisted so a concurrent duplicate collides on the unique
            // index instead of creating a second debit.
            const withdrawalResult = await client.query(`
      INSERT INTO withdrawal_requests (
        user_id, amount_cents, currency, withdrawal_type,
        crypto_address, crypto_network, status, asset_type, idempotency_key
      )
      VALUES ($1, $2, 'USD', 'crypto', $3, $4, 'held', 'usdt', $5)
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
            status: 'held',
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
            // NEW-6: the exact integer that was debited from the ledger drives the
            // on-chain amount, so the chain can never receive more than we took.
            amountCents,
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
        await markSendOutcome(
            withdrawalId,
            request,
            'reconcile',
            `RECONCILIATION_REQUIRED: payout call threw (${sendErr?.message || 'unknown error'})`,
        );
        return {
            success: true,
            withdrawalId,
            status: 'reconcile',
            requiresReconciliation: true,
            message: 'Withdrawal is being verified'
        };
    }

    if (payoutResult.outcome === 'confirmed_sent') {
        // The funds have left our custody. From here on we must NOT refund.
        //
        // R3-11: commit the 'sent' transition FIRST, on its own, claimed from
        // 'held'. Previously the status write shared a transaction with the ledger
        // insert, so a bookkeeping failure rolled the status back and left the row
        // 'held' — i.e. refundable by an operator — after a confirmed broadcast.
        // Durably recording "this money is gone" outranks bookkeeping.
        await markSendOutcome(
            withdrawalId,
            request,
            'sent',
            `SENT: payout ID ${payoutResult.payoutId}`,
            payoutResult.txHash || null,
        );

        try {
            await transaction(async (client) => {
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
        //
        // R3-2: claim the row FIRST, scoped to id + usdt + status='held'. The
        // wallet credit is then conditional on having won that claim, so a replay
        // (or a concurrent resolver) cannot refund the same debit twice.
        await transaction(async (client) => {
            const claim = await client.query(`
        UPDATE withdrawal_requests
        SET status = 'rejected', admin_notes = $1, updated_at = NOW()
        WHERE id = $2 AND asset_type = 'usdt' AND status = 'held'
        RETURNING id
      `, [payoutResult.error || 'Payout failed before broadcast', withdrawalId]);

            if (claim.rowCount !== 1) {
                logger.error('Pre-broadcast refund claim lost — NOT crediting wallet', {
                    userId: request.userId, withdrawalId
                });
                return;
            }

            await client.query(`
        UPDATE wallets
        SET usdt_balance_cents = usdt_balance_cents + $1
        WHERE user_id = $2 AND currency = 'USD'
      `, [amountCents, request.userId]);
        });

        logger.error('Crypto withdrawal failed before broadcast — refunded', {
            userId: request.userId,
            withdrawalId,
            error: payoutResult.error
        });

        throw new AppError('Crypto withdrawal failed: ' + (payoutResult.error || 'payout failed'), 500);
    }

    // outcome === 'unknown' (or unrecognized): AMBIGUOUS. The broadcast may have
    // gone out. NEVER auto-refund — move to 'reconcile' so the row is visibly
    // distinct from one that never reached the provider (R3-11).
    logger.error('Crypto withdrawal outcome UNKNOWN — holding for reconciliation (NO refund)', {
        userId: request.userId,
        withdrawalId,
        error: payoutResult.error
    });
    await markSendOutcome(
        withdrawalId,
        request,
        'reconcile',
        `RECONCILIATION_REQUIRED: ambiguous payout outcome (${payoutResult.error || 'no confirmation'})`,
    );
    return {
        success: true,
        withdrawalId,
        status: 'reconcile',
        requiresReconciliation: true,
        message: 'Withdrawal is being verified'
    };
}

/**
 * 3. Platform User Transfer (Instant P2P)
 */
async function processPlatformTransfer(request: PlatformWithdrawalRequest): Promise<WithdrawalResult> {
    const amountCents = Math.round(request.amount * 100);
    const idempotencyKey = request.idempotencyKey?.trim() || null;
    const currency = 'USD';

    // NEW-8: a platform transfer creates no withdrawal_requests row (it is an
    // instant ledger movement), so its idempotency anchor is the SENDER's
    // transactions row, which carries a UNIQUE idempotency_key. Previously the
    // key was accepted by the interface and discarded, so a double submit moved
    // the money twice. This pre-check is a fast path; the unique index below is
    // the authoritative claim.
    if (idempotencyKey) {
        const prior = await findPriorPlatformTransfer(request.userId, idempotencyKey);
        if (prior) {
            assertIdempotentPayloadMatches(
                { amount_cents: prior.amount_cents, currency: prior.currency, withdrawal_type: 'platform' },
                { amountCents, currency, withdrawalType: 'platform' },
            );
            return {
                success: true,
                idempotent: true,
                message: 'Transfer already completed',
            };
        }
    }

    try {
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

        const description = `Transfer to ${recipient.rows[0].full_name || request.recipientEmail}${request.message ? `: ${request.message}` : ''}`;

        // NEW-8: CLAIM the logical request first, before any money moves, by
        // inserting the sender's ledger row carrying the namespaced idempotency
        // key. A concurrent duplicate collides on
        // idx_transactions_idempotency_unique here and rolls back without having
        // debited anything.
        await client.query(`
      INSERT INTO transactions (
        user_id, idempotency_key, type, status, amount_cents, currency, description
      )
      VALUES ($1, $2, 'transfer_out', 'SUCCESS', $3, $4, $5)
    `, [
            request.userId,
            idempotencyKey ? platformTransferKey(idempotencyKey) : null,
            amountCents, currency, description,
        ]);

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

        // Create the recipient's ledger record. The sender's row was already
        // inserted above as the idempotency claim.
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
    } catch (err: any) {
        // NEW-8: idempotency race — a concurrent duplicate won the unique index on
        // transactions.idempotency_key. The debit and credit in THIS transaction
        // rolled back with it, so return idempotent success instead of a 500.
        if (idempotencyKey && isUniqueViolation(err, 'idx_transactions_idempotency_unique')) {
            const prior = await findPriorPlatformTransfer(request.userId, idempotencyKey);
            if (prior) {
                assertIdempotentPayloadMatches(
                    { amount_cents: prior.amount_cents, currency: prior.currency, withdrawal_type: 'platform' },
                    { amountCents, currency, withdrawalType: 'platform' },
                );
                return {
                    success: true,
                    idempotent: true,
                    message: 'Transfer already completed',
                };
            }
        }
        throw err;
    }
}
