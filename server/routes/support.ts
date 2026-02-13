import { Router, Request, Response } from 'express';

const router = Router();

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@cardxc.online';

/**
 * Public endpoint: returns support contact email for the support page.
 * Used so the support page can show the configured SUPPORT_EMAIL without hardcoding.
 */
router.get('/contact', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { supportEmail: SUPPORT_EMAIL },
  });
});

export { router as supportRouter };
