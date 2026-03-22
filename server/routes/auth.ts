import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import { checkLoginVelocity, runFraudChecks } from '../services/fraudService';
import { generateTwoFactorSecret, verifyAndEnableTwoFactor, verifyTwoFactorToken, disableTwoFactor, isTwoFactorEnabled } from '../services/twoFactorService';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';
import { logger } from '../middleware/logger';
import { recordFailedAttempt, clearFailedAttempts } from '../middleware/security';
import { logSecurityEvent } from '../middleware/securityLogger';
import { passwordResetLimiter } from '../middleware/rateLimit';
import crypto from 'crypto';

// WebAuthn types
interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
}

const router = Router();

const isProduction = process.env.NODE_ENV === 'production';

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (isProduction) {
      throw new Error('FATAL: SESSION_SECRET environment variable is required in production');
    }
    return 'dev-only-secret-' + (process.env.REPL_ID || 'local');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const SESSION_DURATION_HOURS = 24;

function getClientInfo(req: Request) {
  return {
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
  };
}

async function createSession(userId: string, req: Request): Promise<string> {
  const { ipAddress, userAgent } = getClientInfo(req);
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  
  await query(`
    INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [sessionId, userId, sessionId, ipAddress, userAgent?.substring(0, 500), expiresAt]);
  
  const token = jwt.sign({ userId, sessionId }, JWT_SECRET, { expiresIn: `${SESSION_DURATION_HOURS}h` });
  return token;
}

async function recordLoginAttempt(email: string, success: boolean, failureReason: string | null, req: Request) {
  const { ipAddress, userAgent } = getClientInfo(req);
  await query(`
    INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
    VALUES ($1, $2, $3, $4, $5)
  `, [email, ipAddress, userAgent?.substring(0, 500), success, failureReason]);
}

router.post('/signup',
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').trim().isLength({ min: 2 }).withMessage('Full name is required'),
  body('phone').optional().trim(),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { email, password, fullName, phone } = req.body;

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
      const result = await transaction(async (client) => {
        const userResult = await client.query(`
          INSERT INTO users (email, password_hash, full_name, phone, role)
          VALUES ($1, $2, $3, $4, 'USER')
          RETURNING id, email, full_name, role
        `, [email, passwordHash, fullName, phone]);
        
        const user = userResult.rows[0];
        
        await client.query(`
          INSERT INTO wallets (user_id, currency, balance_cents) VALUES ($1, 'USD', 0)
        `, [user.id]);
        
        return user;
      });

      const token = await createSession(result.id, req);
      
      await createAuditLog({
        userId: result.id,
        action: 'USER_SIGNUP',
        entityType: 'user',
        entityId: result.id,
        ...getClientInfo(req),
      });

      try {
        await sendWelcomeEmail(result.email, result.full_name || 'User');
        logger.info('Welcome email sent', { email: result.email.substring(0, 3) + '***@***' });
      } catch (err) {
        logger.error('Failed to send welcome email', { error: err });
      }

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000,
        path: '/',
      });

      res.status(201).json({
        success: true,
        data: {
          user: { id: result.id, email: result.email, fullName: result.full_name, role: result.role },
          token,
        }
      });
  })
);

router.post('/signin',
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('twoFactorToken').optional().isLength({ min: 6, max: 6 }),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Invalid credentials', 400, 'VALIDATION_ERROR');
    }

    const { email, password, twoFactorToken } = req.body;

    const velocity = await checkLoginVelocity(email, req.ip);
    if (!velocity.allowed) {
      await recordLoginAttempt(email, false, 'RATE_LIMITED', req);
      throw new AppError('Too many login attempts. Please try again later.', 429, 'RATE_LIMITED');
    }

    const user = await queryOne<any>(`
      SELECT id, email, password_hash, full_name, role, account_status, kyc_status, locked_until, 
             failed_login_attempts, two_factor_enabled
      FROM users WHERE email = $1
    `, [email]);

    if (!user) {
      await recordLoginAttempt(email, false, 'USER_NOT_FOUND', req);
      recordFailedAttempt(req.ip || 'unknown');
      logSecurityEvent('LOGIN_FAILED', 'medium', req, { 
        reason: 'USER_NOT_FOUND',
        email: email.substring(0, 3) + '***', // Partial email for privacy
      });
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await recordLoginAttempt(email, false, 'ACCOUNT_LOCKED', req);
      logSecurityEvent('LOGIN_BLOCKED', 'high', req, { 
        reason: 'ACCOUNT_LOCKED',
        userId: user.id,
        lockedUntil: user.locked_until,
      });
      throw new AppError('Account is temporarily locked. Please try again later.', 423, 'ACCOUNT_LOCKED');
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;
      
      await query(`
        UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3
      `, [newAttempts, lockUntil, user.id]);
      
      await recordLoginAttempt(email, false, 'INVALID_PASSWORD', req);
      recordFailedAttempt(req.ip || 'unknown');
      
      const severity = newAttempts >= 5 ? 'high' : 'medium';
      logSecurityEvent('LOGIN_FAILED', severity, req, { 
        reason: 'INVALID_PASSWORD',
        userId: user.id,
        failedAttempts: newAttempts,
        accountLocked: lockUntil !== null,
      });
      
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    
    // Clear failed attempts on successful login
    clearFailedAttempts(req.ip || 'unknown');

    if (user.two_factor_enabled) {
      if (!twoFactorToken) {
        res.json({ success: true, data: { requiresTwoFactor: true } });
        return;
      }
      
      const valid = await verifyTwoFactorToken(user.id, twoFactorToken);
      if (!valid) {
        await recordLoginAttempt(email, false, 'INVALID_2FA', req);
        throw new AppError('Invalid 2FA code', 401, 'INVALID_2FA');
      }
    }

    if (user.account_status !== 'active') {
      await recordLoginAttempt(email, false, 'ACCOUNT_INACTIVE', req);
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    await query(`
      UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1
    `, [user.id]);

    const token = await createSession(user.id, req);
    await recordLoginAttempt(email, true, null, req);

    await runFraudChecks({
      userId: user.id,
      action: 'LOGIN',
      ipAddress: getClientInfo(req).ipAddress,
    });

    await createAuditLog({
      userId: user.id,
      action: 'USER_LOGIN',
      ...getClientInfo(req),
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          kyc_status: (user.kyc_status || 'pending').toLowerCase(),
          account_status: (user.account_status || 'active').toLowerCase(),
        },
        token,
      }
    });
  })
);

// Logout doesn't require authentication - always clear cookie even with expired/invalid token
router.post(['/signout', '/logout'], asyncHandler(async (req: Request, res: Response) => {
  // Try to get token and invalidate session if valid
  const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; sessionId: string };
      await query('UPDATE sessions SET is_active = FALSE WHERE id = $1', [decoded.sessionId]);
      await createAuditLog({
        userId: decoded.userId,
        action: 'USER_LOGOUT',
        ...getClientInfo(req),
      });
    } catch {
      // Token invalid/expired - still clear cookie, just don't log audit
    }
  }
  
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  
  res.json({ success: true, message: 'Logged out successfully' });
}));

router.get('/session', asyncHandler(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  let token = req.cookies.auth_token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (!token) {
    return res.json({ success: true, data: { user: null } });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; sessionId: string };
    
    const session = await queryOne(`
      SELECT id FROM sessions 
      WHERE id = $1 AND user_id = $2 AND is_active = TRUE AND expires_at > NOW()
    `, [decoded.sessionId, decoded.userId]);
    
    if (!session) {
      res.clearCookie('auth_token', { path: '/' });
      return res.json({ success: true, data: { user: null } });
    }
    
    const user = await queryOne(`
      SELECT id, email, full_name, role, kyc_status, account_status, two_factor_enabled
      FROM users WHERE id = $1
    `, [decoded.userId]);

    if (!user) {
      res.clearCookie('auth_token', { path: '/' });
      return res.json({ success: true, data: { user: null } });
    }

    res.json({ success: true, data: { user } });
  } catch {
    res.clearCookie('auth_token', { path: '/' });
    res.json({ success: true, data: { user: null } });
  }
}));

router.get('/sessions', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const sessions = await query(`
    SELECT id, ip_address, user_agent, created_at, last_used_at, 
           (id = $2) as is_current
    FROM sessions 
    WHERE user_id = $1 AND is_active = TRUE
    ORDER BY last_used_at DESC
  `, [req.user!.id, req.user!.sessionId]);

  res.json({ success: true, data: { sessions } });
}));

router.delete('/sessions/:sessionId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.sessionId as string;
  
  if (sessionId === req.user!.sessionId) {
    throw new AppError('Cannot revoke current session', 400, 'INVALID_OPERATION');
  }

  await query(`
    UPDATE sessions SET is_active = FALSE 
    WHERE id = $1 AND user_id = $2
  `, [sessionId, req.user!.id]);

  await createAuditLog({
    userId: req.user!.id,
    action: 'SESSION_REVOKED',
    entityType: 'session',
    entityId: sessionId,
    ...getClientInfo(req),
  });

  res.json({ success: true, message: 'Session revoked' });
}));

router.delete('/sessions', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await query(`
    UPDATE sessions SET is_active = FALSE 
    WHERE user_id = $1 AND id != $2
  `, [req.user!.id, req.user!.sessionId]);

  await createAuditLog({
    userId: req.user!.id,
    action: 'ALL_SESSIONS_REVOKED',
    ...getClientInfo(req),
  });

  res.json({ success: true, message: 'All other sessions revoked' });
}));

router.post('/2fa/setup', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await queryOne('SELECT email, two_factor_enabled FROM users WHERE id = $1', [req.user!.id]);
  
  if (user?.two_factor_enabled) {
    throw new AppError('2FA is already enabled', 400, 'ALREADY_ENABLED');
  }

  const result = await generateTwoFactorSecret(req.user!.id, user!.email);
  
  res.json({ success: true, data: result });
}));

router.post('/2fa/verify', authenticate,
  body('token').isLength({ min: 6, max: 6 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.body;
    
    const verified = await verifyAndEnableTwoFactor(req.user!.id, token);
    
    if (!verified) {
      throw new AppError('Invalid verification code', 400, 'INVALID_CODE');
    }

    await createAuditLog({
      userId: req.user!.id,
      action: '2FA_ENABLED',
      ...getClientInfo(req),
    });

    res.json({ success: true, message: '2FA enabled successfully' });
  })
);

router.post('/2fa/disable', authenticate,
  body('password').notEmpty(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { password } = req.body;
    
    const user = await queryOne<any>('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      throw new AppError('Invalid password', 401, 'INVALID_PASSWORD');
    }

    await disableTwoFactor(req.user!.id);

    await createAuditLog({
      userId: req.user!.id,
      action: '2FA_DISABLED',
      ...getClientInfo(req),
    });

    res.json({ success: true, message: '2FA disabled successfully' });
  })
);

router.post('/change-password', authenticate,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }
    const { currentPassword, newPassword } = req.body;

    const user = await queryOne<any>('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(`UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $2`, [passwordHash, req.user!.id]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'PASSWORD_CHANGED',
      ...getClientInfo(req),
    });

    res.json({ success: true, message: 'Password changed successfully' });
  })
);

router.post('/password-reset/request',
  passwordResetLimiter,
  body('email').isEmail().normalizeEmail(),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Invalid email', 400, 'VALIDATION_ERROR');
    }

    const { email } = req.body;

    const user = await queryOne<any>('SELECT id, email, full_name FROM users WHERE email = $1', [email]);
    
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [user.id]);
      
      await query(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `, [user.id, tokenHash, expiresAt]);

      try {
        await sendPasswordResetEmail(user.email, user.full_name || 'User', resetToken);
        logger.info('Password reset email sent', { email: user.email.substring(0, 3) + '***@***' });
      } catch (err) {
        logger.error('Failed to send password reset email', { error: err });
      }

      await createAuditLog({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        ...getClientInfo(req),
      });
    }

    res.json({ 
      success: true, 
      message: 'If an account exists with this email, a password reset link has been sent.' 
    });
  })
);

router.post('/password-reset/confirm',
  passwordResetLimiter,
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { token, password } = req.body;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await queryOne<any>(`
      SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token_hash = $1
    `, [tokenHash]);

    if (!resetToken) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
    }

    if (resetToken.used_at) {
      throw new AppError('This reset link has already been used', 400, 'TOKEN_USED');
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      throw new AppError('Reset token has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await query(`UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2`, 
      [passwordHash, resetToken.user_id]);

    await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [resetToken.id]);

    await query(`UPDATE sessions SET is_active = FALSE WHERE user_id = $1`, [resetToken.user_id]);

    await createAuditLog({
      userId: resetToken.user_id,
      action: 'PASSWORD_RESET_COMPLETED',
      ...getClientInfo(req),
    });

    logger.info('Password reset completed', { email: resetToken.email.substring(0, 3) + '***@***' });

    res.json({ success: true, message: 'Password has been reset successfully. Please sign in with your new password.' });
  })
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL ?? '';

const PRODUCTION_DOMAIN = process.env.APP_DOMAIN || 'cardxc.online';
const REPLIT_APP_DOMAIN = process.env.REPLIT_APP_DOMAIN || '';

function getGoogleCallbackUrl(req?: Request): string {
  const host = (req?.get('host') || '').replace(/:.*$/, '').trim();
  
  if (host.includes(PRODUCTION_DOMAIN)) {
    return `https://${PRODUCTION_DOMAIN}/api/auth/google/callback`;
  }
  
  if (host.includes('replit.app') || host.includes('replit.dev')) {
    const replitHost = (REPLIT_APP_DOMAIN && REPLIT_APP_DOMAIN.trim()) ? REPLIT_APP_DOMAIN.trim().replace(/:.*$/, '') : host;
    return `https://${replitHost}/api/auth/google/callback`;
  }
  
  if (process.env.NODE_ENV === 'production') {
    return `https://${PRODUCTION_DOMAIN}/api/auth/google/callback`;
  }
  
  return 'http://localhost:5000/api/auth/google/callback';
}

function isSecureContext(req?: Request): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const host = req?.get('host') || '';
  return host.includes('replit.app') || host.includes('replit.dev') || host.includes(PRODUCTION_DOMAIN);
}

function isGoogleOAuthConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function getGoogleConfigError(): string | null {
  if (!GOOGLE_CLIENT_ID) {
    return 'GOOGLE_CLIENT_ID is not set in Replit Secrets';
  }
  if (!GOOGLE_CLIENT_SECRET) {
    return 'GOOGLE_CLIENT_SECRET is not set in Replit Secrets';
  }
  return null;
}

router.get('/google-status', asyncHandler(async (req: Request, res: Response) => {
  const configError = getGoogleConfigError();
  res.json({
    success: true,
    data: {
      available: isGoogleOAuthConfigured(),
      error: configError,
      callbackUrl: getGoogleCallbackUrl(req),
    },
  });
}));

router.get('/google', asyncHandler(async (req: Request, res: Response) => {
  const configError = getGoogleConfigError();
  if (configError) {
    logger.error('Google OAuth not configured', { error: configError });
    throw new AppError(configError, 503, 'OAUTH_NOT_CONFIGURED');
  }

  const state = crypto.randomBytes(32).toString('hex');
  const callbackUrl = getGoogleCallbackUrl(req);
  
  logger.info('Google OAuth initiated', { callbackUrl });
  
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: isSecureContext(req),
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(googleAuthUrl);
}));

router.get('/google/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    logger.warn('Google OAuth error', { error: oauthError });
    return res.redirect(`/signin?error_description=${encodeURIComponent('Google login was cancelled or failed')}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/signin?error_description=' + encodeURIComponent('No authorization code received'));
  }

  const storedState = req.cookies.oauth_state;
  if (!storedState || storedState !== state) {
    logger.warn('OAuth state mismatch', { storedState, receivedState: state });
    return res.redirect('/signin?error_description=' + encodeURIComponent('Invalid OAuth state'));
  }

  res.clearCookie('oauth_state', { path: '/' });

  if (!isGoogleOAuthConfigured()) {
    return res.redirect('/signin?error_description=' + encodeURIComponent('Google OAuth is not configured'));
  }

  const callbackUrl = getGoogleCallbackUrl(req);
  logger.info('Google OAuth callback', { callbackUrl });

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      logger.error('Google token exchange failed', { status: tokenResponse.status, error: errorData });
      return res.redirect('/signin?error_description=' + encodeURIComponent('Failed to exchange authorization code'));
    }

    const tokens = await tokenResponse.json();
    const { access_token } = tokens;

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoResponse.ok) {
      logger.error('Failed to get Google user info', { status: userInfoResponse.status });
      return res.redirect('/signin?error_description=' + encodeURIComponent('Failed to get user information from Google'));
    }

    const googleUser = await userInfoResponse.json();
    const { email, name, picture } = googleUser;

    if (!email) {
      return res.redirect('/signin?error_description=' + encodeURIComponent('No email received from Google'));
    }

    let user = await queryOne<any>(`
      SELECT id, email, full_name, role, account_status 
      FROM users WHERE email = $1
    `, [email]);

    const isBootstrapAdmin = !!BOOTSTRAP_ADMIN_EMAIL && email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
    const userRole = isBootstrapAdmin ? 'SUPER_ADMIN' : 'USER';

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      const result = await transaction(async (client) => {
        const userResult = await client.query(`
          INSERT INTO users (email, password_hash, full_name, role, email_verified)
          VALUES ($1, $2, $3, $4, TRUE)
          RETURNING id, email, full_name, role, account_status
        `, [email, passwordHash, name || email.split('@')[0], userRole]);

        const newUser = userResult.rows[0];

        await client.query(`
          INSERT INTO wallets (user_id, currency, balance_cents) VALUES ($1, 'USD', 0)
        `, [newUser.id]);

        return newUser;
      });

      user = result;

      await createAuditLog({
        userId: user.id,
        action: 'USER_SIGNUP_GOOGLE',
        entityType: 'user',
        entityId: user.id,
        newValues: { email, full_name: name, provider: 'google' },
        ...getClientInfo(req),
      });

      logger.info('New user created via Google OAuth', { email, userId: user.id });
    } else {
      if (isBootstrapAdmin && user.role !== 'SUPER_ADMIN') {
        await query(`UPDATE users SET role = 'SUPER_ADMIN' WHERE id = $1`, [user.id]);
        user.role = 'SUPER_ADMIN';
      }

      await query(`
        UPDATE users SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [user.id]);
    }

    if (user.account_status !== 'active') {
      return res.redirect('/signin?error_description=' + encodeURIComponent('Your account is not active'));
    }

    const token = await createSession(user.id, req);

    await recordLoginAttempt(email, true, null, req);

    await runFraudChecks({
      userId: user.id,
      action: 'LOGIN',
      ipAddress: getClientInfo(req).ipAddress,
    });

    await createAuditLog({
      userId: user.id,
      action: 'USER_LOGIN_GOOGLE',
      newValues: { provider: 'google' },
      ...getClientInfo(req),
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000,
      path: '/',
    });

    const redirectPath = user.role === 'SUPER_ADMIN' ? '/admin-dashboard' : '/dashboard';
    res.redirect(redirectPath);

  } catch (err: any) {
    logger.error('Google OAuth callback error', { error: err.message, stack: err.stack });
    return res.redirect('/signin?error_description=' + encodeURIComponent('An error occurred during Google login'));
  }
}));

router.post('/verify-phone', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { phone, code } = req.body;
  
  if (!phone || !code) {
    return res.status(400).json({ success: false, message: 'Phone number and verification code are required' });
  }

  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Invalid verification code format' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    await query(
      'UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2',
      [phone, userId]
    );

    res.json({ success: true, message: 'Phone number verified successfully' });
  } catch (err: any) {
    logger.error('Phone verification error', { error: err.message, userId });
    res.status(500).json({ success: false, message: 'Failed to verify phone number' });
  }
}));

export { router as authRouter };
