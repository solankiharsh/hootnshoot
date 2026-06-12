import { IUploadProvider } from './upload.interface';
import { existsSync, mkdirSync, readFileSync, unlink, writeFileSync } from 'fs';
// @ts-ignore
import mime from 'mime';
import { isAbsolute, resolve } from 'path';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { detectFileTypeFromBuffer } from './file-type.util';
import { isTrustedDownloadHost } from './trusted.download.host';

const LOCAL_STORAGE_ALLOWED_MIME = new Set<string>([
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
export class LocalStorage implements IUploadProvider {
  constructor(private uploadDirectory: string) {
    this.uploadDirectory = isAbsolute(uploadDirectory)
      ? uploadDirectory
      : resolve(process.cwd(), '../..', uploadDirectory);
  }

  /**
   * Same-origin `/uploads/...` URLs (e.g. from Aurora after persisting a data URI)
   * are not valid for `isSafePublicHttpsUrl` (http / localhost are rejected). Read
   * the file from disk instead of fetching.
   */
  private tryReadTrustedOwnUploadUrl(urlStr: string): Buffer | null {
    const baseRaw = process.env.FRONTEND_URL?.trim();
    if (!baseRaw || !urlStr.trim()) {
      return null;
    }
    let fileUrl: URL;
    let baseUrl: URL;
    try {
      fileUrl = new URL(urlStr);
      baseUrl = new URL(baseRaw.replace(/\/+$/, ''));
    } catch {
      return null;
    }
    if (fileUrl.origin !== baseUrl.origin) {
      return null;
    }
    if (!fileUrl.pathname.startsWith('/uploads/')) {
      return null;
    }
    const relative = fileUrl.pathname.slice('/uploads/'.length);
    if (!relative || relative.includes('..')) {
      return null;
    }
    const fsPath = resolve(this.uploadDirectory, relative);
    const root = resolve(this.uploadDirectory);
    if (!fsPath.startsWith(root + '/') && fsPath !== root) {
      return null;
    }
    if (!existsSync(fsPath)) {
      return null;
    }
    return readFileSync(fsPath);
  }

  async uploadSimple(path: string) {
    let body: Buffer;
    let findExtension: string | false;

    const trusted = this.tryReadTrustedOwnUploadUrl(path);
    if (trusted) {
      const detected = await detectFileTypeFromBuffer(trusted);
      if (!detected || !LOCAL_STORAGE_ALLOWED_MIME.has(detected.mime)) {
        throw new Error('Unsupported file type.');
      }
      body = trusted;
      findExtension = detected.ext;
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
      const contentType =
        loadImage?.headers?.get('content-type') ||
        loadImage?.headers?.get('Content-Type');
      findExtension =
        mime.getExtension(contentType) ||
        path.split('?')[0].split('#')[0].split('.').pop() ||
        'bin';

      body = Buffer.from(await loadImage.arrayBuffer());
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const innerPath = `/${year}/${month}/${day}`;
    const dir = `${this.uploadDirectory}${innerPath}`;
    mkdirSync(dir, { recursive: true });

    const randomName = Array(32)
      .fill(null)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');

    const filePath = `${dir}/${randomName}.${findExtension}`;
    const publicPath = `${innerPath}/${randomName}.${findExtension}`;
    // Logic to save the file to the filesystem goes here
    writeFileSync(filePath, body);

    return process.env.FRONTEND_URL + '/uploads' + publicPath;
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    try {
      const detected = await detectFileTypeFromBuffer(file.buffer);
      if (!detected || !LOCAL_STORAGE_ALLOWED_MIME.has(detected.mime)) {
        throw new Error('Unsupported file type.');
      }
      const safeExt = `.${detected.ext}`;
      const safeMime = detected.mime;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const innerPath = `/${year}/${month}/${day}`;
      const dir = `${this.uploadDirectory}${innerPath}`;
      mkdirSync(dir, { recursive: true });

      const randomName = Array(32)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');

      const filePath = `${dir}/${randomName}${safeExt}`;
      const publicPath = `${innerPath}/${randomName}${safeExt}`;

      writeFileSync(filePath, file.buffer);

      return {
        filename: `${randomName}${safeExt}`,
        path: process.env.FRONTEND_URL + '/uploads' + publicPath,
        mimetype: safeMime,
        originalname: `${randomName}${safeExt}`,
      };
    } catch (err) {
      console.error('Error uploading file to Local Storage:', err);
      throw err;
    }
  }

  async removeFile(filePath: string): Promise<void> {
    // Logic to remove the file from the filesystem goes here
    return new Promise((resolve, reject) => {
      unlink(filePath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
