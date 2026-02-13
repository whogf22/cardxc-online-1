import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { financialOpLimiter } from '../middleware/rateLimit';
import { processWithdrawal } from '../services/withdrawalService';

const router = Router();

/**
 * POST /api/withdraw/bank
 * Bank transfer withdrawal
 */
router.post('/bank',
    authenticate,
    financialOpLimiter,
    body('amount').isFloat({ min: 1 }),
    body('currency').isIn(['USD', 'EUR', 'GBP']),
    body('walletType').isIn(['fiat', 'usdt']),
    body('bankName').trim().notEmpty().isLength({ max: 255 }),
    body('accountNumber').trim().notEmpty().isLength({ max: 100 }),
    body('accountName').trim().notEmpty().isLength({ max: 255 }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        const { amount, currency, walletType, bankName, accountNumber, accountName } = req.body;

        const result = await processWithdrawal({
            type: 'bank',
            userId: req.user!.id,
            amount,
            currency,
            walletType,
            bankName,
            accountNumber,
            accountName
        });

        res.status(201).json({
            success: true,
            data: result,
            message: result.message
        });
    })
);

/**
 * POST /api/withdraw/crypto
 * Crypto (USDT) withdrawal to external wallet
 */
router.post('/crypto',
    authenticate,
    financialOpLimiter,
    body('amount').isFloat({ min: 10 }).withMessage('Minimum crypto withdrawal is 10 USDT'),
    body('walletAddress').trim().notEmpty().isLength({ min: 20, max: 255 }),
    body('network').isIn(['TRC20', 'ERC20', 'BEP20', 'POLYGON']),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        const { amount, walletAddress, network } = req.body;

        const result = await processWithdrawal({
            type: 'crypto',
            userId: req.user!.id,
            amount,
            walletAddress,
            network
        });

        res.status(201).json({
            success: true,
            data: result,
            message: result.message
        });
    })
);

/**
 * POST /api/withdraw/platform
 * Transfer to another user on the platform (instant P2P)
 */
router.post('/platform',
    authenticate,
    financialOpLimiter,
    body('amount').isFloat({ min: 1 }),
    body('recipientEmail').isEmail().normalizeEmail(),
    body('walletType').isIn(['fiat', 'usdt']),
    body('message').optional().trim().isLength({ max: 500 }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        const { amount, recipientEmail, walletType, message } = req.body;

        const result = await processWithdrawal({
            type: 'platform',
            userId: req.user!.id,
            recipientEmail,
            amount,
            walletType,
            message
        });

        res.status(201).json({
            success: true,
            data: result,
            message: result.message
        });
    })
);

export { router as withdrawalRouter };
