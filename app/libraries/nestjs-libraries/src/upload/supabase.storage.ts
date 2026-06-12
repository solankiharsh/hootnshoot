import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'multer';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { IUploadProvider } from './upload.interface';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { detectFileTypeFromBuffer } from './file-type.util';
import { isTrustedDownloadHost } from './trusted.download.host';

const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'video/mp4',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
]);

export class SupabaseStorage implements IUploadProvider {
  private readonly client: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly bucket: string;

  constructor(supabaseUrl: string, serviceRoleKey: string, bucket: string) {
    this.supabaseUrl = supabaseUrl.replace(/\/+$/, '');
    this.bucket = bucket;
    this.client = createClient(this.supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private objectKeyFromPublicUrl(urlStr: string): string | null {
    let u: URL;
    try {
      u = new URL(urlStr);
    } catch {
      return null;
    }
    let base: URL;
    try {
      base = new URL(this.supabaseUrl);
    } catch {
      return null;
    }
    if (u.origin !== base.origin) {
      return null;
    }
    const marker = `/object/public/${this.bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) {
      return null;
    }
    const key = u.pathname.slice(idx + marker.length);
    if (!key || key.includes('..')) {
      return null;
    }
    return decodeURIComponent(key);
  }

  private async tryReadOwnObject(urlStr: string): Promise<Buffer | null> {
    const key = this.objectKeyFromPublicUrl(urlStr);
    if (!key) {
      return null;
    }
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(key);
    if (error || !data) {
      return null;
    }
    return Buffer.from(await data.arrayBuffer());
  }

  private buildDatedObjectKey(extension: string): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const id = makeId(10);
    return `${y}/${m}/${d}/${id}.${extension}`;
  }

  async uploadSimple(path: string): Promise<string> {
    let body: Buffer;

    const own = await this.tryReadOwnObject(path);
    if (own) {
      const detected = await detectFileTypeFromBuffer(own);
      if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
        throw new Error('Unsupported file type.');
      }
      body = own;
    } else {
      let parsed: URL;
      try {
        parsed = new URL(path);
      } catch {
        throw new Error('Unsafe URL');
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Unsafe URL');
      }
      const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      const allowVendorFetch = isTrustedDownloadHost(hostname);
      if (!allowVendorFetch && !(await isSafePublicHttpsUrl(path))) {
        throw new Error('Unsafe URL');
      }
      const loadImage = allowVendorFetch
        ? await fetch(path)
        : await fetch(path, {
            // @ts-ignore — undici option, not in lib.dom fetch types
            dispatcher: ssrfSafeDispatcher,
          });
      body = Buffer.from(await loadImage.arrayBuffer());
    }

    const detected = await detectFileTypeFromBuffer(body);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new Error('Unsupported file type.');
    }
    const extension = detected.ext;
    const safeContentType = detected.mime;
    const objectKey = this.buildDatedObjectKey(extension);

    const { error } = await this.client.storage.from(this.bucket).upload(objectKey, body, {
      contentType: safeContentType,
      upsert: false,
      cacheControl: '3600',
    });
    if (error) {
      throw new Error(error.message);
    }

    const { data: pub } = this.client.storage.from(this.bucket).getPublicUrl(objectKey);
    return pub.publicUrl;
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    const detected = await detectFileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new Error('Unsupported file type.');
    }
    const extension = detected.ext;
    const safeContentType = detected.mime;
    const objectKey = this.buildDatedObjectKey(extension);

    const { error } = await this.client.storage.from(this.bucket).upload(objectKey, file.buffer, {
      contentType: safeContentType,
      upsert: false,
      cacheControl: '3600',
    });
    if (error) {
      console.error('Error uploading file to Supabase Storage:', error);
      throw error;
    }

    const { data: pub } = this.client.storage.from(this.bucket).getPublicUrl(objectKey);
    const publicUrl = pub.publicUrl;
    const filename = objectKey.split('/').pop() || objectKey;

    return {
      filename,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      originalname: filename,
      fieldname: 'file',
      path: publicUrl,
      destination: publicUrl,
      encoding: '7bit',
      stream: file.buffer as any,
    };
  }

  async removeFile(filePath: string): Promise<void> {
    const key = this.objectKeyFromPublicUrl(filePath);
    if (!key) {
      return;
    }
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) {
      console.error('SupabaseStorage.removeFile:', error.message);
    }
  }
}
