#!/usr/bin/env node
/**
 * Apply supabase/migrations/*.sql to hosted Postgres without `supabase login`.
 * Uses DIRECT_DATABASE_URL from repo-root .env (JSON or KEY=value).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const appDir = path.join(root, 'app');

function loadRootEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing repo-root .env');
  }
  const raw = fs.readFileSync(envPath, 'utf8').trim();
  if (raw.startsWith('{')) return JSON.parse(raw);
  const out = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

function listMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

const env = loadRootEnv();
const direct = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
if (!direct || !String(direct).includes('supabase')) {
  console.error(
    'Root .env must set DIRECT_DATABASE_URL (or DATABASE_URL) to a Supabase Postgres URL.'
  );
  process.exit(1);
}

const host = String(direct).replace(/^[^@]+@/, '').split(/[/:?]/)[0];
console.log(`Applying Supabase SQL migrations to ${host}…\n`);

const files = listMigrations();
let failed = 0;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  console.log(`→ ${file}`);
  const result = spawnSync(
    'pnpm',
    [
      'dlx',
      'prisma@6.5.0',
      'db',
      'execute',
      '--url',
      direct,
      '--file',
      filePath,
    ],
    { cwd: appDir, stdio: 'inherit', env: process.env }
  );
  if (result.status !== 0) {
    console.error(`  FAILED: ${file}\n`);
    failed += 1;
  } else {
    console.log(`  OK\n`);
  }
}

if (failed) {
  console.error(`${failed} migration(s) failed.`);
  process.exit(1);
}

console.log('All Supabase SQL migrations applied.');
