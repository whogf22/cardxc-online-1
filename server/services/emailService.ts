import nodemailer from 'nodemailer';
import { logger } from '../middleware/logger';

function getSmtpConfig() {
  const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
  const SMTP_USER = process.env.SMTP_USER || '';
  const SMTP_PASS_RAW = process.env.SMTP_PASS || '';
  const SMTP_FROM = process.env.SMTP_FROM || '';

  if (SMTP_PASS_RAW !== SMTP_PASS_RAW.trim()) {
    logger.warn('SMTP_PASS contains leading/trailing whitespace - this may cause authentication failures. Please update the secret without extra spaces.');
  }

  const SMTP_PASS = SMTP_PASS_RAW.trim();

  if (SMTP_USER && !SMTP_USER.includes('@')) {
    logger.warn('SMTP_USER should be a full email address (e.g., admin@cardxc.online). Current value may cause authentication issues.');
  }

  const SMTP_SECURE = SMTP_PORT === 465 ? true : (process.env.SMTP_SECURE === 'true');

  const FROM_EMAIL = SMTP_FROM ? SMTP_FROM.match(/<(.+)>/)?.[1] || SMTP_FROM : (SMTP_USER || 'noreply@cardxc.com');
  const FROM_NAME = SMTP_FROM ? SMTP_FROM.match(/^([^<]+)/)?.[1]?.trim() || 'CardXC' : 'CardXC';

  return {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    user: SMTP_USER,
    pass: SMTP_PASS,
    fromEmail: FROM_EMAIL,
    fromName: FROM_NAME,
  };
}

function createTransporter() {
  const config = getSmtpConfig();

  const transportOptions: any = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  };

  if (config.port === 587 && !config.secure) {
    transportOptions.requireTLS = true;
  }

  if (config.user) {
    transportOptions.auth = { user: config.user, pass: config.pass };
  }

  return nodemailer.createTransport(transportOptions);
}

let transporter = createTransporter();

export function reinitializeTransporter() {
  transporter = createTransporter();
  verifySmtpConnection();
}

export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string; code?: string }> {
  const config = getSmtpConfig();
  
  if (!config.user) {
    logger.warn('SMTP not configured - email features disabled');
    return { success: false, error: 'SMTP_USER not configured' };
  }

  if (!config.pass) {
    logger.warn('SMTP_PASS not set - email features disabled');
    return { success: false, error: 'SMTP_PASS not configured' };
  }

  try {
    await transporter.verify();
    logger.info('SMTP connection verified successfully', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user.substring(0, 3) + '***@' + config.user.split('@')[1]
    });
    return { success: true };
  } catch (error: any) {
    const errorCode = error.code || error.responseCode || 'UNKNOWN';
    const errorMessage = error.message || 'Unknown error';
    
    if (errorCode === 'EAUTH' || errorMessage.includes('535') || errorMessage.includes('authentication failed')) {
      logger.error('SMTP authentication failed (535)', {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        error: errorMessage,
        hint: 'Check SMTP_USER (must be full email) and SMTP_PASS. For Hostinger, use port 465 with secure=true.'
      });
      return { 
        success: false, 
        error: `Authentication failed: ${errorMessage}`, 
        code: 'AUTH_FAILED_535' 
      };
    }

    if (errorCode === 'ECONNECTION' || errorCode === 'ESOCKET') {
      logger.error('SMTP connection failed', {
        host: config.host,
        port: config.port,
        error: errorMessage,
        hint: 'Check SMTP_HOST and SMTP_PORT. For Hostinger, use smtp.hostinger.com:465.'
      });
      return { 
        success: false, 
        error: `Connection failed: ${errorMessage}`, 
        code: 'CONNECTION_FAILED' 
      };
    }

    logger.error('SMTP verification failed', {
      host: config.host,
      port: config.port,
      error: errorMessage,
      code: errorCode
    });
    return { success: false, error: errorMessage, code: errorCode };
  }
}

verifySmtpConnection();

const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to CardXC - Your Account is Ready',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #22c55e, #14b8a6); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
          .brand { font-size: 24px; font-weight: bold; color: #22c55e; margin-top: 10px; }
          .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
          .button { display: inline-block; background: #22c55e; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">C</div>
            <div class="brand">CardXC</div>
          </div>
          <div class="content">
            <h2>Welcome aboard, ${name}!</h2>
            <p>Your CardXC account has been created successfully. You now have access to:</p>
            <ul>
              <li>Virtual payment cards for secure online transactions</li>
              <li>Real-time transaction monitoring</li>
              <li>Multiple currency support</li>
              <li>Advanced security features including 2FA</li>
            </ul>
            <p>Get started by completing your profile and verifying your identity.</p>
            <a href="https://cardxc.online/dashboard" class="button">Go to Dashboard</a>
          </div>
          <div class="footer">
            <p>CardXC - Secure Digital Payments</p>
            <p>If you didn't create this account, please contact support immediately.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to CardXC, ${name}! Your account is ready. Visit https://cardxc.online/dashboard to get started.`,
  }),

  passwordReset: (name: string, resetToken: string) => ({
    subject: 'CardXC - Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #22c55e, #14b8a6); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
          .brand { font-size: 24px; font-weight: bold; color: #22c55e; margin-top: 10px; }
          .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
          .button { display: inline-block; background: #22c55e; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-top: 20px; }
          .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">C</div>
            <div class="brand">CardXC</div>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="https://cardxc.online/reset-password?token=${resetToken}" class="button">Reset Password</a>
            <div class="warning">
              <strong>Security Notice:</strong> This link expires in 1 hour. If you didn't request this reset, please ignore this email or contact support.
            </div>
          </div>
          <div class="footer">
            <p>CardXC - Secure Digital Payments</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, we received a request to reset your CardXC password. Visit https://cardxc.online/reset-password?token=${resetToken} to reset it. This link expires in 1 hour.`,
  }),

  twoFactorEnabled: (name: string) => ({
    subject: 'CardXC - Two-Factor Authentication Enabled',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #22c55e, #14b8a6); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
          .brand { font-size: 24px; font-weight: bold; color: #22c55e; margin-top: 10px; }
          .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
          .success { background: #dcfce7; border: 1px solid #22c55e; padding: 15px; border-radius: 8px; color: #166534; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">C</div>
            <div class="brand">CardXC</div>
          </div>
          <div class="content">
            <h2>Two-Factor Authentication Enabled</h2>
            <p>Hi ${name},</p>
            <div class="success">
              <strong>Your account is now more secure!</strong> Two-factor authentication has been successfully enabled on your CardXC account.
            </div>
            <p style="margin-top: 20px;">From now on, you'll need to enter a code from your authenticator app when signing in. Make sure to keep your backup codes in a safe place.</p>
            <p><strong>If you didn't enable 2FA</strong>, please contact our support team immediately as your account may be compromised.</p>
          </div>
          <div class="footer">
            <p>CardXC - Secure Digital Payments</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, two-factor authentication has been enabled on your CardXC account. If you didn't make this change, contact support immediately.`,
  }),

  transactionAlert: (name: string, type: string, amount: string, currency: string) => ({
    subject: `CardXC - Transaction Alert: ${type} ${amount} ${currency}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #22c55e, #14b8a6); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
          .brand { font-size: 24px; font-weight: bold; color: #22c55e; margin-top: 10px; }
          .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
          .amount { font-size: 32px; font-weight: bold; color: #22c55e; }
          .details { background: white; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">C</div>
            <div class="brand">CardXC</div>
          </div>
          <div class="content">
            <h2>Transaction Alert</h2>
            <p>Hi ${name},</p>
            <p>A ${type.toLowerCase()} was made on your account:</p>
            <div class="details">
              <p class="amount">${amount} ${currency}</p>
              <p><strong>Type:</strong> ${type}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="margin-top: 20px;">If you don't recognize this transaction, please contact our support team immediately.</p>
          </div>
          <div class="footer">
            <p>CardXC - Secure Digital Payments</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, a ${type.toLowerCase()} of ${amount} ${currency} was made on your CardXC account. If you don't recognize this, contact support.`,
  }),

  emailVerification: (name: string, verificationToken: string) => ({
    subject: 'CardXC - Verify Your Email Address',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #22c55e, #14b8a6); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
          .brand { font-size: 24px; font-weight: bold; color: #22c55e; margin-top: 10px; }
          .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
          .button { display: inline-block; background: #22c55e; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-top: 20px; }
          .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">C</div>
            <div class="brand">CardXC</div>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Hi ${name},</p>
            <p>Thank you for signing up for CardXC! Please verify your email address by clicking the button below:</p>
            <a href="https://cardxc.online/verify-email?token=${verificationToken}" class="button">Verify Email</a>
            <div class="warning">
              <strong>Note:</strong> This link expires in 24 hours. If you didn't create an account with CardXC, please ignore this email.
            </div>
          </div>
          <div class="footer">
            <p>CardXC - Secure Digital Payments</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, thank you for signing up for CardXC! Please verify your email by visiting: https://cardxc.online/verify-email?token=${verificationToken}. This link expires in 24 hours.`,
  }),

  suspiciousActivity: (name: string, activity: string, details: string) => ({
    subject: 'CardXC - Security Alert: Suspicious Activity Detected',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
          .brand { font-size: 24px; font-weight: bold; color: #ef4444; margin-top: 10px; }
          .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
          .alert { background: #fef2f2; border: 1px solid #ef4444; padding: 15px; border-radius: 8px; color: #dc2626; }
          .button { display: inline-block; background: #ef4444; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">!</div>
            <div class="brand">Security Alert</div>
          </div>
          <div class="content">
            <h2>Suspicious Activity Detected</h2>
            <p>Hi ${name},</p>
            <div class="alert">
              <strong>${activity}</strong><br>
              ${details}
            </div>
            <p style="margin-top: 20px;">If this was you, you can safely ignore this email. If you don't recognize this activity, please secure your account immediately:</p>
            <a href="https://cardxc.online/settings/security" class="button">Secure My Account</a>
          </div>
          <div class="footer">
            <p>CardXC - Secure Digital Payments</p>
            <p>For immediate assistance, contact support@cardxc.online</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name}, suspicious activity detected on your CardXC account: ${activity}. ${details}. If this wasn't you, secure your account immediately at https://cardxc.online/settings/security`,
  }),
};

export async function sendEmail(to: string, template: keyof typeof emailTemplates, ...args: any[]): Promise<boolean> {
  const config = getSmtpConfig();
  
  if (!config.user) {
    logger.warn('Email not sent - SMTP_USER not configured', { to, template });
    return false;
  }

  if (!config.pass) {
    logger.warn('Email not sent - SMTP_PASS not configured', { to, template });
    return false;
  }

  try {
    const templateFn = emailTemplates[template] as (...args: any[]) => { subject: string; html: string; text: string };
    const { subject, html, text } = templateFn(...args);

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
      text,
    });

    logger.info('Email sent successfully', { to, template });
    return true;
  } catch (error: any) {
    const errorCode = error.code || error.responseCode || 'UNKNOWN';
    const errorMessage = error.message || 'Unknown error';
    
    if (errorMessage.includes('535') || errorMessage.includes('authentication failed')) {
      logger.error('Email send failed - authentication error (535)', { 
        to, 
        template, 
        error: errorMessage,
        hint: 'Check SMTP_USER (full email) and SMTP_PASS in Secrets'
      });
    } else {
      logger.error('Failed to send email', { to, template, error: errorMessage, code: errorCode });
    }
    return false;
  }
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string; code?: string }> {
  const config = getSmtpConfig();
  
  if (!config.user || !config.pass) {
    return { 
      success: false, 
      error: 'SMTP not configured', 
      code: 'NOT_CONFIGURED' 
    };
  }

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject: 'CardXC Email Test',
      text: `This is a test email from CardXC. Sent at ${new Date().toISOString()}`,
      html: `<h2>CardXC Email Test</h2><p>This is a test email from CardXC.</p><p>Sent at: ${new Date().toISOString()}</p>`,
    });

    logger.info('Test email sent successfully', { to });
    return { success: true };
  } catch (error: any) {
    const errorCode = error.code || error.responseCode || 'UNKNOWN';
    const errorMessage = error.message || 'Unknown error';
    
    if (errorMessage.includes('535') || errorMessage.includes('authentication failed')) {
      logger.error('Test email failed - authentication error (535)', { 
        to, 
        error: errorMessage,
        config: {
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: config.user
        }
      });
      return { 
        success: false, 
        error: `Authentication failed: ${errorMessage}. Verify SMTP_USER is full email address and SMTP_PASS is correct.`,
        code: 'AUTH_FAILED_535'
      };
    }
    
    logger.error('Test email failed', { to, error: errorMessage, code: errorCode });
    return { success: false, error: errorMessage, code: errorCode };
  }
}

export function getSmtpDiagnostics(): {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  passSet: boolean;
  passHasWhitespace: boolean;
} {
  const config = getSmtpConfig();
  const rawPass = process.env.SMTP_PASS || '';
  
  return {
    configured: !!(config.user && config.pass),
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user || null,
    passSet: !!config.pass,
    passHasWhitespace: rawPass !== rawPass.trim(),
  };
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  return sendEmail(email, 'welcome', name);
}

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<boolean> {
  return sendEmail(email, 'passwordReset', name, resetToken);
}

export async function sendTwoFactorEnabledEmail(email: string, name: string): Promise<boolean> {
  return sendEmail(email, 'twoFactorEnabled', name);
}

export async function sendTransactionAlert(email: string, name: string, type: string, amount: string, currency: string): Promise<boolean> {
  return sendEmail(email, 'transactionAlert', name, type, amount, currency);
}

export async function sendSuspiciousActivityAlert(email: string, name: string, activity: string, details: string): Promise<boolean> {
  return sendEmail(email, 'suspiciousActivity', name, activity, details);
}

export async function sendEmailVerification(email: string, name: string, verificationToken: string): Promise<boolean> {
  return sendEmail(email, 'emailVerification', name, verificationToken);
}
