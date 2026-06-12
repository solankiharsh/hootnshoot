import { PostgresStore } from '@mastra/pg';

/**
 * PR #40: use `ssl: { rejectUnauthorized: false }` against Supabase / managed Postgres so ECS
 * does not fail with SELF_SIGNED_CERT_IN_CHAIN.
 *
 * Local Postgres (Makefile / Docker on localhost) does not speak TLS — only skip TLS when the
 * host is clearly loopback, sslmode=disable, or MASTRA_POSTGRES_USE_TLS=false (e.g. ECS sidecar).
 *
 * node-pg can still honour `sslmode=verify-full` / `verify-ca` from the URL and verify the chain
 * even when `ssl` is passed; strip those params so explicit `ssl` below is the single source of
 * truth (no ECS env access required for NODE_EXTRA_CA_CERTS in the common managed-Postgres case).
 */
const PG_URL_TLS_QUERY_KEYS = [
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslcrldir',
  'sslsni',
] as const;

function sanitizePostgresUrlForMastraPool(connectionString: string): string {
  if (!connectionString) {
    return connectionString;
  }
  try {
    const normalized = connectionString.replace(/^postgresql:/i, 'http:');
    const u = new URL(normalized);
    for (const key of PG_URL_TLS_QUERY_KEYS) {
      u.searchParams.delete(key);
    }
    return u.toString().replace(/^http:/i, 'postgresql:');
  } catch {
    return connectionString;
  }
}

function mastraPostgresSsl(
  connectionString: string
): false | { rejectUnauthorized: boolean } {
  const tlsOffEnv =
    process.env.MASTRA_POSTGRES_USE_TLS === '0' ||
    process.env.MASTRA_POSTGRES_USE_TLS === 'false';
  if (tlsOffEnv) {
    return false;
  }
  if (/sslmode=disable/i.test(connectionString)) {
    return false;
  }
  try {
    const normalized = connectionString.replace(/^postgresql:/i, 'http:');
    const host = new URL(normalized).hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    ) {
      return false;
    }
  } catch {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: false };
}

const mastraDatabaseUrl = process.env.DATABASE_URL ?? '';

export const pStore = new PostgresStore({
  id: 'hootnshoot-store',
  connectionString: sanitizePostgresUrlForMastraPool(mastraDatabaseUrl),
  ssl: mastraPostgresSsl(mastraDatabaseUrl),
});
