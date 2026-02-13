/**
 * Run local user schema (users, sessions, wallets) against DATABASE_URL.
 * Use after creating the database: createdb cardxc
 *
 * Usage: DATABASE_URL=postgresql://localhost:5432/cardxc npm run db:schema
 */

import { pool } from './pool';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const sql = readFileSync(join(__dirname, 'local-user-schema.sql'), 'utf-8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Local user schema applied.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Schema failed:', err.message);
  process.exit(1);
});
