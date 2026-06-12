/**
 * Smoke-test Hootnshoot Content Cop **backend** integration (Nest public webhook).
 *
 * Requires a running API (local or deployed). Reads repo root `.env.preview` for:
 *   NEXT_PUBLIC_BACKEND_URL — base URL of the NestJS API (no trailing slash)
 *
 * What it does:
 *   1) POST /public/content-cop/callback with a synthetic body (unknown job_id) — must return 200 quickly.
 *
 * Usage (from repository root):
 *   node scripts/smoke-compliance-backend.mjs
 *
 * Optional override:
 *   BACKEND_SMOKE_URL=http://127.0.0.1:3000 node scripts/smoke-compliance-backend.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env.preview');

const TIMEOUT_MS = 15_000;

function loadEnvPreview(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) {
    return out;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function normalizeBase(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
}

async function timedFetch(url, init) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const env = { ...loadEnvPreview(envFile), ...process.env };
  const base = normalizeBase(
    env.BACKEND_SMOKE_URL || env.NEXT_PUBLIC_BACKEND_URL
  );
  if (!base) {
    console.error(
      'Set NEXT_PUBLIC_BACKEND_URL in .env.preview (or BACKEND_SMOKE_URL).'
    );
    process.exit(1);
  }

  const callbackUrl = `${base}/public/content-cop/callback`;
  console.log('Compliance backend smoke');
  console.log(`  POST ${callbackUrl}`);

  const body = {
    job_id: '00000000-0000-4000-8000-000000000099',
    status: 'completed',
    result_data: {
      decision: 'Approved',
      compliance_score: 100,
      violations: [],
      suggested_edits: [],
      breakdown: {},
    },
  };

  const started = Date.now();
  const res = await timedFetch(callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - started;

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    console.error(`HTTP ${res.status} (${elapsed}ms)`);
    console.error(text.slice(0, 2000));
    process.exit(1);
  }

  if (json?.received !== true) {
    console.error('Expected JSON { received: true }, got:', text.slice(0, 500));
    process.exit(1);
  }

  console.log(`  HTTP ${res.status} in ${elapsed}ms`);
  console.log(`  body: ${JSON.stringify(json)}`);
  console.log('Smoke passed (webhook endpoint responds 200 immediately).');
}

main().catch((e) => {
  const code = e?.cause?.code || e?.code;
  if (code === 'ECONNREFUSED') {
    console.error(
      'Could not connect to the API. Start the backend (e.g. make dev-backend) or set BACKEND_SMOKE_URL.'
    );
  } else {
    console.error(e);
  }
  process.exit(1);
});
