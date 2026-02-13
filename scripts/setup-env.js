#!/usr/bin/env node
/**
 * Copy .env.development.example to .env if .env does not exist.
 * Run: node scripts/setup-env.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.development.example');

if (fs.existsSync(envPath)) {
  console.log('.env already exists. Skipping.');
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error('.env.development.example not found.');
  process.exit(1);
}

fs.copyFileSync(examplePath, envPath);
console.log('Created .env from .env.development.example. Edit .env and set DATABASE_URL and SESSION_SECRET.');
