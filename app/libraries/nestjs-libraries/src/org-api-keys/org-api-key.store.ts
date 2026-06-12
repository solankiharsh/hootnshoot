import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  ORG_API_KEYS,
  OrgApiKeyIdentifier,
} from '@gitroom/nestjs-libraries/org-api-keys/org-api-key.constants';

/**
 * Non-DI key resolution bridge.
 *
 * Social providers (e.g. the Late providers) are plain class instances created
 * outside Nest DI, so they cannot inject Prisma. Any process that boots the
 * database module registers a fetcher here (see OrgApiKeyService); processes
 * without one simply fall back to env vars — identical to pre-BYOK behavior.
 */
export type OrgApiKeyFetcher = (
  organizationId: string,
  identifier: string
) => Promise<string | null>; // returns the ENCRYPTED key, or null when the org has none

let _fetcher: OrgApiKeyFetcher | null = null;

export function registerOrgApiKeyFetcher(fetcher: OrgApiKeyFetcher) {
  _fetcher = fetcher;
}

const CACHE_TTL_SECONDS = 60;
// Sentinel cached for orgs without a key, so misses don't hit the DB on every call
const CACHE_MISS = '__no_org_key__';

const cacheKey = (organizationId: string, identifier: string) =>
  `org-api-key:${organizationId}:${identifier}`;

function envFallback(identifier: OrgApiKeyIdentifier): string | null {
  for (const envVar of ORG_API_KEYS[identifier].envVars) {
    const value = process.env[envVar]?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Resolve the API key for an organization: org-scoped key from the database
 * (cached in Redis, stored encrypted) with a terminal fallback to env vars.
 */
export async function resolveOrgApiKey(
  identifier: OrgApiKeyIdentifier,
  organizationId?: string | null
): Promise<string | null> {
  if (organizationId && _fetcher) {
    try {
      const key = cacheKey(organizationId, identifier);
      const cached = await ioRedis.get(key);
      if (cached === CACHE_MISS) return envFallback(identifier);
      if (cached) return AuthService.fixedDecryption(cached);

      const encrypted = await _fetcher(organizationId, identifier);
      await ioRedis.set(key, encrypted ?? CACHE_MISS, 'EX', CACHE_TTL_SECONDS);
      if (encrypted) return AuthService.fixedDecryption(encrypted);
    } catch (err) {
      console.error(
        `[OrgApiKey] failed to resolve ${identifier} for org ${organizationId}, falling back to env`,
        err
      );
    }
  }
  return envFallback(identifier);
}

/** True when the org resolves a key from its own settings (not the env fallback). */
export async function hasOrgScopedKey(
  identifier: OrgApiKeyIdentifier,
  organizationId: string
): Promise<boolean> {
  if (!_fetcher) return false;
  try {
    const encrypted = await _fetcher(organizationId, identifier);
    return !!encrypted;
  } catch {
    return false;
  }
}

export async function invalidateOrgApiKeyCache(
  organizationId: string,
  identifier: string
): Promise<void> {
  try {
    await ioRedis.del(cacheKey(organizationId, identifier));
  } catch {
    /* cache invalidation is best-effort */
  }
}
