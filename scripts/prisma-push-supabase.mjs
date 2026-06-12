#!/usr/bin/env node
/**
 * Push schema.prisma to hosted Supabase using repo-root .env (JSON or KEY=value).
 * Does not read app/.env (make env overwrites that with local Docker URLs).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

function loadRootEnv() {
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

const env = loadRootEnv();
const direct = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
if (!direct || !String(direct).includes('supabase')) {
  console.error(
    'Root .env must set DIRECT_DATABASE_URL (or DATABASE_URL) to a Supabase Postgres URL.'
  );
  process.exit(1);
}

const host = String(direct).replace(/^[^@]+@/, '').split(/[/:?]/)[0];
console.log(`Pushing Prisma schema to Supabase (${host})…`);

const appDir = path.join(root, 'app');
const result = spawnSync(
  'pnpm',
  [
    'dlx',
    'prisma@6.5.0',
    'db',
    'push',
    '--accept-data-loss',
    '--schema',
    './libraries/nestjs-libraries/src/database/prisma/schema.prisma',
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL: direct,
      DIRECT_DATABASE_URL: direct,
    },
    stdio: 'inherit',
    cwd: appDir,
  }
);

process.exit(result.status ?? 1);
