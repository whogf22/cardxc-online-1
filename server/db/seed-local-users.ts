/**
 * Seed local dev users into the CardXC database.
 * Run after applying local-user-schema.sql.
 *
 * Usage:
 *   DATABASE_URL=postgresql://localhost:5432/cardxc npx tsx server/db/seed-local-users.ts
 *
 * Default test users (change in production):
 *   - test@cardxc.local / Password1!
 *   - admin@cardxc.local / Admin1! (SUPER_ADMIN)
 */

import { pool } from './pool';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

const LOCAL_USERS = [
  {
    email: 'test@cardxc.local',
    password: 'Password1!',
    full_name: 'Test User',
    role: 'USER' as const,
  },
  {
    email: 'admin@cardxc.local',
    password: 'Admin1!',
    full_name: 'Local Admin',
    role: 'SUPER_ADMIN' as const,
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    for (const u of LOCAL_USERS) {
      const password_hash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
      await client.query(
        `
        INSERT INTO users (email, password_hash, full_name, role, email_verified, account_status, kyc_status)
        VALUES ($1, $2, $3, $4, TRUE, 'active', 'pending')
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          updated_at = CURRENT_TIMESTAMP
        `,
        [u.email, password_hash, u.full_name, u.role]
      );
      console.log(`User upserted: ${u.email} (${u.role})`);
    }
    // Ensure each user has a USD wallet
    const ids = await client.query('SELECT id FROM users WHERE email = ANY($1)', [
      LOCAL_USERS.map((u) => u.email),
    ]);
    for (const row of ids.rows) {
      await client.query(
        `
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, 'USD', 0)
        ON CONFLICT (user_id, currency) DO NOTHING
        `,
        [row.id]
      );
    }
    console.log('Local user DB seed done.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
