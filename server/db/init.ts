import { pool } from './pool';
import { logger } from '../middleware/logger';
import bcrypt from 'bcryptjs';

export async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        country VARCHAR(100),
        role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'SUPER_ADMIN')),
        kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected', 'expired')),
        account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'limited', 'suspended', 'closed')),
        email_verified BOOLEAN DEFAULT FALSE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret VARCHAR(255),
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        device_info TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        device_fingerprint VARCHAR(64) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        country VARCHAR(100),
        city VARCHAR(100),
        is_trusted BOOLEAN DEFAULT FALSE,
        first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, device_fingerprint)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        currency VARCHAR(10) NOT NULL,
        balance_cents BIGINT DEFAULT 0,
        reserved_cents BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, currency)
      )
    `);
    await client.query(`
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS usdt_balance_cents BIGINT DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        idempotency_key VARCHAR(255) UNIQUE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'adjustment', 'payment')),
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REVERSED')),
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        reference VARCHAR(255),
        description TEXT,
        merchant_name VARCHAR(255),
        merchant_display_name VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(255);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_display_name VARCHAR(255);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        withdrawal_type VARCHAR(20) DEFAULT 'bank' CHECK (withdrawal_type IN ('bank', 'crypto')),
        bank_name VARCHAR(255),
        account_number VARCHAR(100),
        account_name VARCHAR(255),
        crypto_address VARCHAR(255),
        crypto_network VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
        admin_notes TEXT,
        approved_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add new columns to existing table
    await client.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS withdrawal_type VARCHAR(20) DEFAULT 'bank'`);
    await client.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS crypto_address VARCHAR(255)`);
    await client.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS crypto_network VARCHAR(50)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        requested_by UUID REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        type VARCHAR(20) CHECK (type IN ('credit', 'debit')),
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS security_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        ip_address VARCHAR(45),
        user_agent TEXT,
        path TEXT,
        method VARCHAR(10),
        details JSONB,
        risk_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fraud_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        flag_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        description TEXT,
        metadata JSONB,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'reviewed', 'dismissed', 'confirmed')),
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        success BOOLEAN NOT NULL,
        failure_reason VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS virtual_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        card_name VARCHAR(100),
        last_four VARCHAR(4),
        card_type VARCHAR(20) DEFAULT 'VISA',
        balance_cents BIGINT DEFAULT 0,
        spending_limit_cents BIGINT,
        currency VARCHAR(10) DEFAULT 'USD',
        is_single_use BOOLEAN DEFAULT FALSE,
        fluz_card_id VARCHAR(255) DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS card_controls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES virtual_cards(id) ON DELETE CASCADE UNIQUE,
        frozen BOOLEAN DEFAULT FALSE,
        merchant_blocklist JSONB DEFAULT '[]',
        category_limits JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS card_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES virtual_cards(id) ON DELETE CASCADE,
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        merchant VARCHAR(255),
        category VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(100) DEFAULT 'New Chat',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(20) UNIQUE NOT NULL,
        amount_cents BIGINT,
        currency VARCHAR(10) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS qr_payment_intents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(20) UNIQUE NOT NULL,
        type VARCHAR(20) DEFAULT 'receive',
        amount_cents BIGINT,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID REFERENCES users(id),
        recipient_name VARCHAR(255),
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        frequency VARCHAR(20) CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
        next_run_at TIMESTAMP,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS split_bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        total_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS split_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        split_id UUID REFERENCES split_bills(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        email VARCHAR(255),
        name VARCHAR(255),
        amount_cents BIGINT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS savings_vaults (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        target_cents BIGINT DEFAULT 0,
        balance_cents BIGINT DEFAULT 0,
        currency VARCHAR(10) NOT NULL,
        emoji VARCHAR(10) DEFAULT '💰',
        color VARCHAR(10) DEFAULT '#22c55e',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS roundup_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        enabled BOOLEAN DEFAULT FALSE,
        vault_id UUID REFERENCES savings_vaults(id),
        multiplier INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        limit_cents BIGINT NOT NULL,
        spent_cents BIGINT DEFAULT 0,
        period VARCHAR(20) CHECK (period IN ('weekly', 'monthly')),
        currency VARCHAR(10) NOT NULL,
        alert_threshold INTEGER DEFAULT 80,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, category, currency)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS budget_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
        message TEXT,
        read BOOLEAN DEFAULT FALSE,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reward_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        transaction_id UUID REFERENCES transactions(id),
        cashback_cents BIGINT NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'credited')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        code VARCHAR(20) UNIQUE NOT NULL,
        total_referrals INTEGER DEFAULT 0,
        total_earned_cents BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inviter_id UUID REFERENCES users(id),
        invitee_id UUID REFERENCES users(id) UNIQUE,
        code_id UUID REFERENCES referral_codes(id),
        bonus_cents BIGINT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users(id)`);
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referred_id UUID REFERENCES users(id)`);
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)`);
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        merchant VARCHAR(255) NOT NULL,
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        frequency VARCHAR(20) CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')),
        next_charge_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, is_active) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_unique ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_flags_user_id ON fraud_flags(user_id);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
      CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_payment_links_code ON payment_links(code);
      CREATE INDEX IF NOT EXISTS idx_savings_vaults_user ON savings_vaults(user_id);
      CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
      CREATE INDEX IF NOT EXISTS idx_virtual_cards_user_id ON virtual_cards(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_card_transactions_card_id ON card_transactions(card_id);
      CREATE INDEX IF NOT EXISTS idx_split_bills_creator_id ON split_bills(creator_id);
      CREATE INDEX IF NOT EXISTS idx_recurring_transfers_user_id ON recurring_transfers(user_id);
    `);

    await bootstrapSuperAdmin(client);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        transports TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS card_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        merchant_name VARCHAR(255),
        provider_payment_id VARCHAR(255) UNIQUE,
        checkout_url TEXT,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED')),
        transaction_id UUID REFERENCES transactions(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE card_orders ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE card_orders ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_webhook_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100),
        payload JSONB,
        signature VARCHAR(255),
        processed BOOLEAN DEFAULT FALSE,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_card_orders_user_id ON card_orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_card_orders_provider_payment_id ON card_orders(provider_payment_id);
      CREATE INDEX IF NOT EXISTS idx_card_orders_status ON card_orders(status);
      CREATE INDEX IF NOT EXISTS idx_card_orders_created_at ON card_orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_event_type ON payment_webhook_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_created_at ON payment_webhook_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_processed ON payment_webhook_logs(processed);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crypto_ledger_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_order_id UUID NOT NULL REFERENCES card_orders(id) ON DELETE CASCADE,
        source_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
        crypto_type VARCHAR(20) NOT NULL,
        amount_cents BIGINT NOT NULL,
        exchange_rate NUMERIC(20, 8) NOT NULL,
        usd_equivalent_cents BIGINT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_order_id, user_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_crypto_ledger_entries_user_id ON crypto_ledger_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_crypto_ledger_entries_source_order_id ON crypto_ledger_entries(source_order_id);
      CREATE INDEX IF NOT EXISTS idx_crypto_ledger_entries_created_at ON crypto_ledger_entries(created_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS gift_card_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('buy', 'sell')),
        brand VARCHAR(100) NOT NULL,
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        rate NUMERIC(5, 2),
        cost_cents BIGINT,
        profit_cents BIGINT,
        market_rate NUMERIC(5, 2),
        our_rate NUMERIC(5, 2),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
        card_code TEXT,
        admin_notes TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE gift_card_requests ADD COLUMN IF NOT EXISTS cost_cents BIGINT`);
    await client.query(`ALTER TABLE gift_card_requests ADD COLUMN IF NOT EXISTS profit_cents BIGINT`);
    await client.query(`ALTER TABLE gift_card_requests ADD COLUMN IF NOT EXISTS market_rate NUMERIC(5, 2)`);
    await client.query(`ALTER TABLE gift_card_requests ADD COLUMN IF NOT EXISTS our_rate NUMERIC(5, 2)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gift_card_requests_user_id ON gift_card_requests(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gift_card_requests_status ON gift_card_requests(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gift_card_requests_created_at ON gift_card_requests(created_at DESC)`);

    // OTP table for deposit verification
    await client.query(`
      CREATE TABLE IF NOT EXISTS deposit_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id UUID REFERENCES card_orders(id) ON DELETE CASCADE,
        otp_code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        attempts INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deposit_otps_user_id ON deposit_otps(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deposit_otps_order_id ON deposit_otps(order_id)`);

    logger.info('Database schema initialized');
  } finally {
    client.release();
  }
}

async function bootstrapSuperAdmin(client: any) {
  const bootstrapEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const bootstrapPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

  if (!bootstrapEmail || !bootstrapPassword) {
    logger.info('No bootstrap admin configured (set BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_PASSWORD)');
    return;
  }

  if (bootstrapPassword.length < 8) {
    logger.warn('Bootstrap password must be at least 8 characters');
    return;
  }

  const existing = await client.query('SELECT id, role, password_hash FROM users WHERE email = $1', [bootstrapEmail]);

  if (existing.rows.length === 0) {
    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(bootstrapPassword, 12);
    } catch (err) {
      logger.error('Bootstrap: bcrypt hash failed', err);
      return;
    }
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, role, kyc_status, account_status, email_verified)
      VALUES ($1, $2, $3, 'SUPER_ADMIN', 'approved', 'active', TRUE)
    `, [bootstrapEmail, hashedPassword, 'Super Administrator']);
    logger.info('Bootstrap SUPER_ADMIN account created');
  } else {
    const currentUser = existing.rows[0];
    if (currentUser.role !== 'SUPER_ADMIN' || currentUser.account_status !== 'active') {
      await client.query(`
        UPDATE users 
        SET role = 'SUPER_ADMIN', account_status = 'active', updated_at = NOW()
        WHERE email = $1
      `, [bootstrapEmail]);
      logger.info('Bootstrap SUPER_ADMIN role and status updated');
    }
    if (process.env.BOOTSTRAP_FORCE_PASSWORD_UPDATE === 'true') {
      let hashedPassword: string;
      try {
        hashedPassword = await bcrypt.hash(bootstrapPassword, 12);
      } catch (err) {
        logger.error('Bootstrap: bcrypt hash failed on force update', err);
        return;
      }
      await client.query(`
        UPDATE users SET password_hash = $2, updated_at = NOW() WHERE email = $1
      `, [bootstrapEmail, hashedPassword]);
      logger.info('Bootstrap SUPER_ADMIN password updated (forced)');
    }
  }
}
