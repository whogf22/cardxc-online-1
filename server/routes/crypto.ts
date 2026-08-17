import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import {
    createDepositIntent,
    getDepositStatus,
    getUserCryptoTransactions,
    getTransactionByHash,
    getWalletBalance,
} from '../services/tronDepositMonitor';
import {
    getCryptoDepositAddresses,
    isCryptoProviderConfigured,
    getCryptoProviderName,
    getSupportedNetworks,
} from '../services/cryptoProviderService';

const router = Router();

router.get('/config',
    authenticate,
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
        const addresses = getCryptoDepositAddresses();
        res.json({
            success: true,
            data: {
                providerName: getCryptoProviderName(),
                providerConfigured: isCryptoProviderConfigured(),
                supportedNetworks: getSupportedNetworks(),
                addresses,
            },
        });
    })
);

router.post('/deposit/intent',
    authenticate,
    body('amount').isFloat({ min: 1 }).withMessage('Minimum deposit is 1 USDT'),
    body('fromAddress').optional().trim().isLength({ min: 20, max: 50 }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        // SECURITY (FIN-1): `fromAddress` is accepted for the user's own reference
        // ONLY. It does NOT determine who an incoming deposit is credited to —
        // attribution is by the server-generated, unique `expectedAmount` below.
        const { amount, fromAddress } = req.body;
        const result = await createDepositIntent(req.user!.id, parseFloat(amount), fromAddress);

        res.status(201).json({
            success: true,
            data: result,
            message: `Deposit intent created. Send EXACTLY ${result.expectedAmount} USDT (TRC-20) to the provided address. A different amount cannot be credited automatically.`,
        });
    })
);

router.get('/deposit/:depositId/status',
    authenticate,
    param('depositId').isUUID(),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError('Invalid deposit ID', 400, 'VALIDATION_ERROR');
        }

        const deposit = await getDepositStatus(req.params.depositId as string, req.user!.id);
        if (!deposit) {
            throw new AppError('Deposit not found', 404);
        }

        res.json({ success: true, data: deposit });
    })
);

router.get('/transactions',
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const transactions = await getUserCryptoTransactions(req.user!.id, limit);
        res.json({ success: true, data: transactions });
    })
);

router.get('/tx/:txHash',
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const txInfo = await getTransactionByHash(req.params.txHash as string);
        if (!txInfo) {
            throw new AppError('Transaction not found on blockchain', 404);
        }
        res.json({ success: true, data: txInfo });
    })
);

// Platform hot-wallet on-chain balance. ADMIN-ONLY: this is the shared treasury
// deposit address, not a per-user balance, so exposing it to normal users leaks
// operational treasury size and aids targeting.
router.get('/wallet/balance',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const balance = await getWalletBalance();
        if (!balance) {
            throw new AppError('Could not fetch wallet balance', 500);
        }
        res.json({ success: true, data: balance });
    })
);

export { router as cryptoRouter };
