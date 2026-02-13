// CardXC Email Templates

const BRAND_COLOR = '#6366f1';
const COMPANY_NAME = 'CardXC';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@cardxc.online';
const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'https://cardxc.online';

function baseTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 28px; font-weight: 700; color: ${BRAND_COLOR}; }
    .btn { display: inline-block; background: ${BRAND_COLOR}; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .btn:hover { background: #4f46e5; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #666; }
    .amount { font-size: 32px; font-weight: 700; color: ${BRAND_COLOR}; }
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .success { background: #f0fdf4; border: 1px solid #bbf7d0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">${COMPANY_NAME}</div>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.</p>
      <p style="font-size:11px;color:#888;margin-top:4px;">CardXC is a digital wallet and payments platform operated by GameNova Vault LLC.</p>
      <p>Questions? Contact us at ${SUPPORT_EMAIL}</p>
    </div>
  </div>
</body>
</html>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  const content = `
    <h2>Welcome to ${COMPANY_NAME}, ${name}! 🎉</h2>
    <p>Thank you for joining ${COMPANY_NAME}. We're excited to have you on board.</p>
    <p>With your new account, you can:</p>
    <ul>
      <li>✅ Create virtual cards for secure online payments</li>
      <li>✅ Send and receive money instantly</li>
      <li>✅ Track your spending with insights</li>
      <li>✅ Earn rewards on every transaction</li>
    </ul>
    <div style="text-align: center;">
      <a href="${APP_URL}/dashboard" class="btn">Go to Dashboard</a>
    </div>
    <p>If you have any questions, our support team is here to help!</p>
  `;
  return { subject: `Welcome to ${COMPANY_NAME}! 🎉`, html: baseTemplate(content, 'Welcome') };
}

export function verifyEmailTemplate(name: string, verifyUrl: string): { subject: string; html: string } {
  const content = `
    <h2>Verify Your Email</h2>
    <p>Hi ${name},</p>
    <p>Please verify your email address by clicking the button below:</p>
    <div style="text-align: center;">
      <a href="${verifyUrl}" class="btn">Verify Email</a>
    </div>
    <p style="font-size: 12px; color: #666;">This link expires in 24 hours. If you didn't create an account, please ignore this email.</p>
  `;
  return { subject: 'Verify Your Email - CardXC', html: baseTemplate(content, 'Verify Email') };
}

export function passwordResetTemplate(name: string, resetUrl: string): { subject: string; html: string } {
  const content = `
    <h2>Reset Your Password</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <div class="alert">
      <strong>⚠️ Security Notice:</strong> This link expires in 1 hour. If you didn't request this, please ignore this email and your password will remain unchanged.
    </div>
  `;
  return { subject: 'Reset Your Password - CardXC', html: baseTemplate(content, 'Reset Password') };
}

export function transactionReceivedTemplate(name: string, amount: number, currency: string, senderName: string): { subject: string; html: string } {
  const content = `
    <h2>You Received Money! 💰</h2>
    <p>Hi ${name},</p>
    <p style="text-align: center;">
      <span class="amount">${currency} ${amount.toFixed(2)}</span>
      <br><span style="color: #666;">from ${senderName}</span>
    </p>
    <div class="alert success">
      ✅ This amount has been added to your wallet.
    </div>
    <div style="text-align: center;">
      <a href="${APP_URL}/wallet" class="btn">View Wallet</a>
    </div>
  `;
  return { subject: `You received ${currency} ${amount.toFixed(2)} from ${senderName}`, html: baseTemplate(content, 'Money Received') };
}

export function withdrawalApprovedTemplate(name: string, amount: number, currency: string): { subject: string; html: string } {
  const content = `
    <h2>Withdrawal Approved ✅</h2>
    <p>Hi ${name},</p>
    <p>Great news! Your withdrawal request has been approved.</p>
    <p style="text-align: center;">
      <span class="amount">${currency} ${amount.toFixed(2)}</span>
    </p>
    <p>The funds will be transferred to your bank account within 1-3 business days.</p>
    <div style="text-align: center;">
      <a href="${APP_URL}/transactions" class="btn">View Transactions</a>
    </div>
  `;
  return { subject: `Withdrawal of ${currency} ${amount.toFixed(2)} Approved`, html: baseTemplate(content, 'Withdrawal Approved') };
}

export function withdrawalRejectedTemplate(name: string, amount: number, currency: string, reason: string): { subject: string; html: string } {
  const content = `
    <h2>Withdrawal Request Update</h2>
    <p>Hi ${name},</p>
    <p>Unfortunately, your withdrawal request for <strong>${currency} ${amount.toFixed(2)}</strong> could not be processed.</p>
    <div class="alert">
      <strong>Reason:</strong> ${reason}
    </div>
    <p>The amount has been returned to your wallet. Please contact support if you have questions.</p>
    <div style="text-align: center;">
      <a href="mailto:${SUPPORT_EMAIL}" class="btn">Contact Support</a>
    </div>
  `;
  return { subject: 'Withdrawal Request Update', html: baseTemplate(content, 'Withdrawal Update') };
}

export function securityAlertTemplate(name: string, alertType: string, details: string, ipAddress?: string): { subject: string; html: string } {
  const content = `
    <h2>🔐 Security Alert</h2>
    <p>Hi ${name},</p>
    <div class="alert">
      <strong>${alertType}</strong>
      <p>${details}</p>
      ${ipAddress ? `<p style="font-size: 12px;">IP Address: ${ipAddress}</p>` : ''}
    </div>
    <p>If this was you, no action is needed. If you don't recognize this activity, please secure your account immediately:</p>
    <div style="text-align: center;">
      <a href="${APP_URL}/profile/security" class="btn">Review Security Settings</a>
    </div>
  `;
  return { subject: `Security Alert: ${alertType}`, html: baseTemplate(content, 'Security Alert') };
}

export function twoFactorCodeTemplate(name: string, code: string): { subject: string; html: string } {
  const content = `
    <h2>Your Verification Code</h2>
    <p>Hi ${name},</p>
    <p>Your two-factor authentication code is:</p>
    <p style="text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: ${BRAND_COLOR};">${code}</p>
    <p style="font-size: 12px; color: #666; text-align: center;">This code expires in 10 minutes.</p>
    <div class="alert">
      ⚠️ Never share this code with anyone. ${COMPANY_NAME} will never ask for your verification code.
    </div>
  `;
  return { subject: `${code} is your ${COMPANY_NAME} verification code`, html: baseTemplate(content, 'Verification Code') };
}

export function referralBonusTemplate(name: string, bonusAmount: number, referredName: string): { subject: string; html: string } {
  const content = `
    <h2>Referral Bonus Earned! 🎁</h2>
    <p>Hi ${name},</p>
    <p>Great news! Your friend <strong>${referredName}</strong> just joined ${COMPANY_NAME} using your referral.</p>
    <p style="text-align: center;">
      <span class="amount">+$${bonusAmount.toFixed(2)}</span>
      <br><span style="color: #666;">added to your wallet</span>
    </p>
    <p>Keep sharing and earning! Your referral code is in your dashboard.</p>
    <div style="text-align: center;">
      <a href="${APP_URL}/referrals" class="btn">View Referrals</a>
    </div>
  `;
  return { subject: `You earned $${bonusAmount.toFixed(2)} referral bonus! 🎁`, html: baseTemplate(content, 'Referral Bonus') };
}
