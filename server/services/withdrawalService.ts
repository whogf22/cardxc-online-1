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

export type WithdrawalType = 'bank' | 'crypto' | 'platform';
export type WalletType = 'fiat' | 'usdt';

interface BankWithdrawalRequest {
    type: 'bank';
    userId: string;
    amount: number;
    currency: string;
    walletType: WalletType;
    bankName: string;
    accountNumber: string;
    accountName: string;
}

interface CryptoWithdrawalRequest {
    type: 'crypto';
    userId: string;
    amount: number; // Amount in USDT
    walletAddress: string;
    network: string; // TRC20, ERC20, etc.
}

interface PlatformWithdrawalRequest {
    type: 'platform';
    userId: string;
    recipientEmail: string;
    amount: number;
    walletType: WalletType;
    message?: string;
}

type WithdrawalRequest = BankWithdrawalRequest | CryptoWithdrawalRequest | PlatformWithdrawalRequest;

/**
 * Process withdrawal request based on type
 */
export async function processWithdrawal(request: WithdrawalRequest) {
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

            // Deduct from USDT balance
            await client.query(`
        UPDATE wallets 
        SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [amountCents, request.userId, request.currency]);

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
 * 2. Crypto Transfer (USDT to external wallet)
 */
async function processCryptoWithdrawal(request: CryptoWithdrawalRequest) {
    const amountCents = Math.round(request.amount * 100);

    // Minimum amount check
    if (request.amount < 10) {
        throw new AppError('Minimum crypto withdrawal is 10 USDT', 400);
    }

    let withdrawalId: string = '';

    // Step 1: Deduct balance and create withdrawal request in a transaction
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

        // Deduct USDT
        await client.query(`
      UPDATE wallets 
      SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
      WHERE user_id = $2 AND currency = 'USD'
    `, [amountCents, request.userId]);

        // Create withdrawal request with pending_payout status
        const withdrawalResult = await client.query(`
      INSERT INTO withdrawal_requests (
        user_id, amount_cents, currency, withdrawal_type,
        crypto_address, crypto_network, status
      )
      VALUES ($1, $2, 'USD', 'crypto', $3, $4, 'pending_payout')
      RETURNING id
    `, [
            request.userId, amountCents,
            request.walletAddress, request.network
        ]);

        withdrawalId = withdrawalResult.rows[0].id;
    });

    // Step 2: Now that transaction is committed, initiate external payout
    try {
        const payoutResult = await sendCryptoToWallet({
            userId: request.userId,
            amount: request.amount,
            walletAddress: request.walletAddress,
            network: request.network as any,
            transactionId: withdrawalId
        });

        if (payoutResult.success) {
            // Step 3: Update withdrawal status to processing after successful payout
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
        } else {
            throw new Error('Payout failed: ' + (payoutResult.error || 'Unknown error'));
        }

    } catch (error: any) {
        // Step 4: Refund if payout fails
        await transaction(async (client) => {
            await client.query(`
        UPDATE wallets 
        SET usdt_balance_cents = usdt_balance_cents + $1
        WHERE user_id = $2 AND currency = 'USD'
      `, [amountCents, request.userId]);

            await client.query(`
        UPDATE withdrawal_requests 
        SET status = 'failed', admin_notes = $1
        WHERE id = $2
      `, [error.message, withdrawalId]);
        });

        logger.error('Crypto withdrawal failed', {
            userId: request.userId,
            withdrawalId,
            error: error.message
        });

        throw new AppError('Crypto withdrawal failed: ' + error.message, 500);
    }
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

            // Deduct from sender USDT
            await client.query(`
        UPDATE wallets 
        SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [amountCents, request.userId, currency]);

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

            // Deduct from sender
            await client.query(`
        UPDATE wallets 
        SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [amountCents, request.userId, currency]);

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
