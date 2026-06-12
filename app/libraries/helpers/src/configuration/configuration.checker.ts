import { readFileSync, existsSync } from 'fs';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

export class ConfigurationChecker {
  cfg: dotenv.DotenvParseOutput;
  issues: string[] = [];

  readEnvFromFile() {
    const envFile = resolve(__dirname, '../../../.env');

    if (!existsSync(envFile)) {
      console.error('Env file not found!: ', envFile);
      return;
    }

    const handle = readFileSync(envFile, 'utf-8');

    this.cfg = dotenv.parse(handle);
  }

  readEnvFromProcess() {
    this.cfg = process.env;
  }

  check() {
    this.checkDatabaseServers();
    this.checkOptionalPostgresConnectionString('DIRECT_DATABASE_URL');
    this.checkOptionalSupabaseEnv();
    this.checkNonEmpty('JWT_SECRET');
    this.checkIsValidUrl('MAIN_URL');
    this.checkIsValidUrl('FRONTEND_URL');
    this.checkIsValidUrl('NEXT_PUBLIC_BACKEND_URL');
    this.checkIsValidUrl('BACKEND_INTERNAL_URL');
    this.checkNonEmpty('STORAGE_PROVIDER', 'Needed to setup storage.');
    this.checkStorageForProvider();
  }

  checkStorageForProvider(): void {
    const p = (this.get('STORAGE_PROVIDER') || 'local').trim().toLowerCase();
    if (p === 'supabase') {
      this.checkNonEmpty('SUPABASE_URL');
      this.checkNonEmpty('SUPABASE_SERVICE_ROLE_KEY');
      this.checkNonEmpty(
        'SUPABASE_STORAGE_BUCKET',
        'Supabase Storage bucket id (create in Dashboard → Storage; set bucket public read for media URLs).'
      );
    }
    if (p === 'cloudflare') {
      for (const key of [
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_ACCESS_KEY',
        'CLOUDFLARE_SECRET_ACCESS_KEY',
        'CLOUDFLARE_REGION',
        'CLOUDFLARE_BUCKETNAME',
        'CLOUDFLARE_BUCKET_URL',
      ] as const) {
        this.checkNonEmpty(key);
      }
    }
  }

  checkNonEmpty(key: string, description?: string): boolean {
    const v = this.get(key);

    if (!description) {
      description = '';
    }

    if (!v) {
      this.issues.push(key + ' not set. ' + description);
      return false;
    }

    if (v.length === 0) {
      this.issues.push(key + ' is empty.' + description);
      return false;
    }

    return true;
  }

  get(key: string): string | undefined {
    return this.cfg[key as keyof typeof this.cfg];
  }

  checkDatabaseServers() {
    this.checkRedis();
    this.checkIsValidUrl('DATABASE_URL');
  }

  checkRedis() {
    if (!this.cfg.REDIS_URL) {
      this.issues.push('REDIS_URL not set');
    }

    try {
      const redisUrl = new URL(this.cfg.REDIS_URL);

      if (redisUrl.protocol !== 'redis:') {
        this.issues.push('REDIS_URL must start with redis://');
      }
    } catch (error) {
      this.issues.push('REDIS_URL is not a valid URL');
    }
  }

  checkIsValidUrl(key: string) {
    if (!this.checkNonEmpty(key)) {
      return;
    }

    const urlString = this.get(key);

    try {
      new URL(urlString);
    } catch (error) {
      this.issues.push(key + ' is not a valid URL');
    }

    if (urlString.endsWith('/')) {
      this.issues.push(key + ' should not end with /');
    }
  }

  /** When set, must look like a Postgres connection URL (used for Prisma directUrl / Supabase). */
  checkOptionalPostgresConnectionString(key: string) {
    const raw = this.get(key);
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return;
    }
    const urlString = String(raw).trim();
    try {
      const u = new URL(urlString);
      if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') {
        this.issues.push(
          `${key} must use postgres:// or postgresql:// scheme`
        );
      }
    } catch {
      this.issues.push(`${key} is not a valid URL`);
    }
  }

  /** Optional Supabase project keys — validate only when provided. */
  checkOptionalSupabaseEnv() {
    const url = this.get('SUPABASE_URL');
    if (url !== undefined && url !== null && String(url).trim() !== '') {
      const u = String(url).trim();
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          this.issues.push('SUPABASE_URL must be http(s)');
        }
      } catch {
        this.issues.push('SUPABASE_URL is not a valid URL');
      }
      if (u.endsWith('/')) {
        this.issues.push('SUPABASE_URL should not end with /');
      }
    }
    for (const key of ['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
      const v = this.get(key);
      if (v !== undefined && v !== null && String(v).trim() === '') {
        this.issues.push(`${key} is set but empty`);
      }
    }
  }

  hasIssues() {
    return this.issues.length > 0;
  }

  getIssues() {
    return this.issues;
  }

  getIssuesCount() {
    return this.issues.length;
  }
}
