import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

interface BrandAsset {
  id: string;
  name: string;
  path: string;
  url: string;
  folder: string;
  size: number;
}

interface StorageListEntry {
  name: string;
  id?: string | null;
  metadata?: { size?: number; mimetype?: string } | null;
}

const SKIP_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db', '.emptyFolderPlaceholder']);
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.bmp',
  '.ico',
]);
const VERIFY_CONCURRENCY = 12;
const HEAD_TIMEOUT_MS = 8_000;

@ApiTags('Brand Assets')
@Controller('/supabase')
export class BrandAssetsController {
  private cache: { data: BrandAsset[]; ts: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  private getConfig(): { base: string; key: string; bucket: string } {
    const base = process.env.SUPABASE_URL?.replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Brand library lives in the dedicated `assets` bucket (see TESTING/Supabase uploads).
    // Do not use SUPABASE_STORAGE_BUCKET — that is user media (hootnshoot-media), dated paths.
    const bucket =
      process.env.SUPABASE_BRAND_ASSETS_BUCKET?.trim() || 'assets';

    if (!base || !key) {
      throw new ServiceUnavailableException(
        'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
      );
    }

    return { base, key, bucket };
  }

  private storageHeaders(key: string, extra?: Record<string, string>) {
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...extra,
    };
  }

  private publicUrl(base: string, bucket: string, objectPath: string) {
    const encoded = objectPath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
  }

  private isImageCandidate(name: string, metadata?: { size?: number; mimetype?: string } | null): boolean {
    if (!name || SKIP_FILE_NAMES.has(name)) return false;
    if (name.startsWith('.')) return false;

    const size = metadata?.size ?? 0;
    if (size <= 0) return false;

    const mimetype = metadata?.mimetype?.toLowerCase() ?? '';
    if (mimetype) {
      return mimetype.startsWith('image/');
    }

    const dot = name.lastIndexOf('.');
    if (dot < 0) return false;
    return IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
  }

  private async verifyPublicImageUrl(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      });
      if (!res.ok) return false;
      const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
      return (
        contentType.startsWith('image/') || contentType.includes('svg')
      );
    } catch {
      return false;
    }
  }

  private async filterReachableAssets(assets: BrandAsset[]): Promise<BrandAsset[]> {
    const reachable: BrandAsset[] = [];

    for (let i = 0; i < assets.length; i += VERIFY_CONCURRENCY) {
      const batch = assets.slice(i, i + VERIFY_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (asset) => {
          const ok = await this.verifyPublicImageUrl(asset.url);
          if (!ok) {
            console.warn(
              `[BrandAssets] Skipping unreachable asset: ${asset.path} (${asset.url})`
            );
          }
          return ok ? asset : null;
        })
      );
      reachable.push(...results.filter((a): a is BrandAsset => a !== null));
    }

    return reachable;
  }

  private async listAllAssets(
    base: string,
    key: string,
    bucket: string
  ): Promise<BrandAsset[]> {
    const assets: BrandAsset[] = [];
    const queue = [''];

    while (queue.length > 0) {
      const prefix = queue.shift() ?? '';
      const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: this.storageHeaders(key, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Error listing ${bucket}/${prefix}:`, body);
        continue;
      }

      const entries = (await res.json()) as StorageListEntry[];

      for (const entry of entries) {
        const fullPath = prefix ? `${prefix}${entry.name}` : entry.name;
        const isFolder =
          entry.id == null && entry.metadata == null;

        if (isFolder) {
          queue.push(`${fullPath}/`);
          continue;
        }

        if (!this.isImageCandidate(entry.name, entry.metadata)) {
          continue;
        }

        const folder = prefix.replace(/\/$/, '') || 'root';
        assets.push({
          id: entry.id || fullPath,
          name: entry.name,
          path: fullPath,
          url: this.publicUrl(base, bucket, fullPath),
          folder,
          size: entry.metadata?.size ?? 0,
        });
      }
    }

    assets.sort((a, b) => {
      if (a.folder !== b.folder) {
        return a.folder.localeCompare(b.folder);
      }
      return a.name.localeCompare(b.name);
    });

    return assets;
  }

  @Get('/brand-assets')
  async getBrandAssets(): Promise<BrandAsset[]> {
    try {
      if (this.cache && Date.now() - this.cache.ts < this.CACHE_TTL_MS) {
        return this.cache.data;
      }
      const { base, key, bucket } = this.getConfig();
      const listed = await this.listAllAssets(base, key, bucket);
      const data = await this.filterReachableAssets(listed);
      this.cache = { data, ts: Date.now() };
      return data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      console.error('Error fetching brand assets:', error);
      throw new HttpException(
        'Failed to fetch brand assets',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
