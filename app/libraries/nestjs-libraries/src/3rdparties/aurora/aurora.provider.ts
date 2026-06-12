import { mkdirSync, writeFileSync } from 'fs';
import { basename, isAbsolute, resolve } from 'path';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import {
  ThirdParty,
  ThirdPartyAbstract,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';

/** Aurora OpenAPI `AspectRatio` */
export type AuroraAspectRatio =
  | '1:1'
  | '3:4'
  | '4:3'
  | '16:9'
  | '9:16'
  | '21:9';

export type AuroraImageProvider = 'google' | 'openai';
export type AuroraImageModel = 'imagen4' | 'gemini' | 'mix';

export type AuroraLifestyleRegion =
  | 'Asia'
  | 'Africa'
  | 'Latam'
  | 'Europe'
  | 'Middle East'
  | 'North America'
  | 'Oceania'
  | 'South Asia'
  | 'Southeast Asia';

export type AuroraLifestyleGender = 'Man' | 'Woman' | 'Non-binary';
export type AuroraLifestyleSetting = 'Indoor' | 'Outdoor';
export type AuroraLifestyleActivity =
  | 'None'
  | 'Using Phone'
  | 'Using Computer';
export type AuroraLifestyleClothingStyle =
  | 'Professional'
  | 'Casual'
  | 'Regional Appropriate';
export type AuroraLifestyleTimeOfDay =
  | 'Daytime'
  | 'Golden Hour'
  | 'Evening';

const CREATIVE_PERSONAS = new Set([
  'editorial',
  'paradox',
  'nostalgic',
  'minimal',
  'candid',
  'data_hero',
  'split',
]);

const ASPECT_RATIOS = new Set<string>([
  '1:1',
  '3:4',
  '4:3',
  '16:9',
  '9:16',
  '21:9',
]);

const REGIONS = new Set<string>([
  'Asia',
  'Africa',
  'Latam',
  'Europe',
  'Middle East',
  'North America',
  'Oceania',
  'South Asia',
  'Southeast Asia',
]);

/**
 * Matches Aurora OpenAPI (`/api/openapi.json`): Video Cluster uses `X-API-Key`
 * on `/api/v2/video/*`. Creative Studio: JSON body. Lifestyle Gen: multipart.
 */
export type AuroraSendPayload = {
  mode: 'creative-studio' | 'lifestyle-gen';
  /** Creative Studio: required prompt. Lifestyle: maps to `brief` if `lifestyle_brief` omitted */
  prompt: string;
  aspect_ratio: AuroraAspectRatio;

  /** Creative Studio — optional persona archetypes */
  personas?: string[];
  on_brand?: boolean;
  logo?: boolean;
  disclaimer?: boolean;
  image_provider?: AuroraImageProvider;

  /** Lifestyle Gen — required enums in API; optional here (server defaults if missing) */
  region?: AuroraLifestyleRegion;
  gender?: AuroraLifestyleGender;
  setting?: AuroraLifestyleSetting;
  activity?: AuroraLifestyleActivity;
  clothing_style?: AuroraLifestyleClothingStyle;
  time_of_day?: AuroraLifestyleTimeOfDay;
  num_images?: number;
  image_model?: AuroraImageModel;
  /** Lifestyle image provider (same enum as creative `image_provider`) */
  lifestyle_image_provider?: AuroraImageProvider;
  city?: string;
  /** Lifestyle scene text; defaults to `prompt` */
  lifestyle_brief?: string;
  guidelines_text?: string;
  /** Optional file: sent as multipart `guidelines_file` after base64 decode */
  guidelines_file?: { filename: string; data_base64: string };
};

function trimBaseUrl(base: string): string {
  return base.replace(/\/+$/, '');
}

function videoClusterApiKey(): string {
  return (
    process.env.AURORA_API_KEY?.trim() ||
    process.env.VIDEO_CLUSTER_API_KEY?.trim() ||
    ''
  );
}

function videoClusterHeaders(jsonBody: boolean): Record<string, string> {
  const key = videoClusterApiKey();
  const h: Record<string, string> = {
    'X-API-Key': key,
  };
  if (jsonBody) {
    h['Content-Type'] = 'application/json';
  }
  return h;
}

function uploadRootDirectory(): string {
  const dir = process.env.UPLOAD_DIRECTORY || '/uploads';
  return isAbsolute(dir) ? dir : resolve(process.cwd(), '../..', dir);
}

async function persistDataUriAsUploadUrl(dataUri: string): Promise<string> {
  const m = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUri.trim());
  if (!m) {
    throw new Error('Aurora returned an image in an unsupported format (expected data URI)');
  }
  const mimePart = (m[1] || 'image/png').split(';')[0].trim().toLowerCase();
  const ext =
    mimePart === 'image/jpeg' || mimePart === 'image/jpg'
      ? 'jpg'
      : mimePart === 'image/webp'
        ? 'webp'
        : mimePart === 'image/gif'
          ? 'gif'
          : 'png';

  let buffer: Buffer;
  try {
    buffer = Buffer.from(m[2], 'base64');
  } catch {
    throw new Error('Aurora returned invalid base64 image data');
  }

  const provider = (process.env.STORAGE_PROVIDER || 'local').trim().toLowerCase();
  if (provider === 'supabase' || provider === 'cloudflare') {
    const uploaded = await UploadFactory.createStorage().uploadFile({
      fieldname: 'file',
      originalname: `aurora.${ext}`,
      encoding: '7bit',
      mimetype: mimePart === 'image/jpg' ? 'image/jpeg' : mimePart,
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: Readable.from(buffer) as any,
    } as Express.Multer.File);
    return uploaded.path;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const innerPath = `/${year}/${month}/${day}`;
  const dir = `${uploadRootDirectory()}${innerPath}`;
  mkdirSync(dir, { recursive: true });

  const randomName = randomBytes(16).toString('hex');
  const publicPath = `${innerPath}/${randomName}.${ext}`;
  const filePath = `${dir}/${randomName}.${ext}`;
  writeFileSync(filePath, buffer);

  const frontend = process.env.FRONTEND_URL?.replace(/\/+$/, '') || '';
  if (!frontend) {
    throw new Error('FRONTEND_URL must be set to persist Aurora images');
  }
  return `${frontend}/uploads${publicPath}`;
}

async function normalizeImageForUploadPipeline(raw: string): Promise<string> {
  const s = raw.trim();
  if (s.startsWith('https://')) {
    return s;
  }
  if (s.startsWith('data:')) {
    return persistDataUriAsUploadUrl(s);
  }
  throw new Error('Aurora returned an image URL that is not HTTPS or data URI');
}

function firstImageFromResponse(json: Record<string, unknown>): string | null {
  const images = json.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === 'string' && first.trim()) {
      return first.trim();
    }
  }
  return null;
}

async function readJsonRecord(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function pickAspectRatio(raw: string | undefined): AuroraAspectRatio {
  if (raw && ASPECT_RATIOS.has(raw)) {
    return raw as AuroraAspectRatio;
  }
  return '1:1';
}

function pickImageProvider(
  raw: string | undefined
): AuroraImageProvider {
  return raw === 'openai' ? 'openai' : 'google';
}

function buildCreativeStudioJson(body: AuroraSendPayload): Record<string, unknown> {
  const personas = (body.personas ?? []).filter((p) =>
    CREATIVE_PERSONAS.has(p)
  );
  const payload: Record<string, unknown> = {
    prompt: body.prompt.trim(),
    aspect_ratio: pickAspectRatio(body.aspect_ratio),
    on_brand: body.on_brand ?? false,
    logo: body.logo ?? false,
    disclaimer: body.disclaimer ?? false,
    image_provider: pickImageProvider(body.image_provider),
  };
  if (personas.length > 0) {
    payload.personas = personas;
  }
  return payload;
}

function safeGuidelinesFilename(name: string): string {
  const base = basename(name.trim() || 'guidelines');
  if (!base || base.includes('..') || base.length > 200) {
    throw new Error('Invalid guidelines filename');
  }
  if (!/^[a-zA-Z0-9._\- ]+$/.test(base)) {
    throw new Error('Guidelines filename may only contain letters, numbers, spaces, dot, dash, underscore');
  }
  return base;
}

function buildLifestyleFormData(body: AuroraSendPayload): FormData {
  const fd = new FormData();

  const region = body.region && REGIONS.has(body.region) ? body.region : 'Europe';
  const gender =
    body.gender === 'Man' || body.gender === 'Woman' || body.gender === 'Non-binary'
      ? body.gender
      : 'Woman';
  const setting = body.setting === 'Outdoor' ? 'Outdoor' : 'Indoor';
  const activity =
    body.activity === 'None' ||
    body.activity === 'Using Phone' ||
    body.activity === 'Using Computer'
      ? body.activity
      : 'Using Computer';
  const clothing_style =
    body.clothing_style === 'Casual' ||
    body.clothing_style === 'Regional Appropriate'
      ? body.clothing_style
      : 'Professional';
  const time_of_day =
    body.time_of_day === 'Golden Hour' || body.time_of_day === 'Evening'
      ? body.time_of_day
      : 'Daytime';

  fd.set('region', region);
  fd.set('gender', gender);
  fd.set('setting', setting);
  fd.set('activity', activity);
  fd.set('clothing_style', clothing_style);
  fd.set('time_of_day', time_of_day);
  fd.set('aspect_ratio', pickAspectRatio(body.aspect_ratio));

  const n = Math.min(4, Math.max(1, Math.floor(body.num_images ?? 1)));
  fd.set('num_images', String(n));

  const model =
    body.image_model === 'gemini' || body.image_model === 'mix'
      ? body.image_model
      : 'imagen4';
  fd.set('image_model', model);

  const lifestyleProv = pickImageProvider(
    body.lifestyle_image_provider ?? body.image_provider
  );
  fd.set('image_provider', lifestyleProv);

  const brief = (body.lifestyle_brief ?? body.prompt).trim();
  if (brief) {
    fd.set('brief', brief);
  }
  if (body.city?.trim()) {
    fd.set('city', body.city.trim());
  }
  if (body.guidelines_text?.trim()) {
    fd.set('guidelines_text', body.guidelines_text.trim());
  }

  const gf = body.guidelines_file;
  if (gf?.data_base64 && gf.filename) {
    const safeName = safeGuidelinesFilename(gf.filename);
    let buf: Buffer;
    try {
      buf = Buffer.from(gf.data_base64, 'base64');
    } catch {
      throw new Error('Invalid guidelines_file base64');
    }
    if (buf.length > 10 * 1024 * 1024) {
      throw new Error('guidelines_file exceeds 10MB');
    }
    if (buf.length === 0) {
      throw new Error('guidelines_file is empty');
    }
    fd.append(
      'guidelines_file',
      new Blob([new Uint8Array(buf)]),
      safeName
    );
  }

  return fd;
}

@ThirdParty({
  identifier: 'aurora',
  title: 'Aurora',
  description: 'Generate campaign and lifestyle images using Aurora AI.',
  position: 'media',
  fields: [],
})
export class AuroraProvider extends ThirdPartyAbstract<AuroraSendPayload> {
  async checkConnection(
    _apiKey: string
  ): Promise<false | { name: string; username: string; id: string }> {
    if (!videoClusterApiKey()) {
      return false;
    }
    return {
      name: 'Aurora',
      username: 'aurora',
      id: 'aurora-builtin',
    };
  }

  async sendData(
    _apiKey: string,
    body: AuroraSendPayload
  ): Promise<string> {
    if (!videoClusterApiKey()) {
      throw new Error(
        'AURORA_API_KEY (or VIDEO_CLUSTER_API_KEY) not configured — Video Cluster requires X-API-Key'
      );
    }

    const BASE = process.env.AURORA_BASE_URL?.trim();
    if (!BASE) {
      throw new Error('AURORA_BASE_URL not configured');
    }

    const base = trimBaseUrl(BASE);
    const { mode, prompt } = body;

    if (mode === 'creative-studio') {
      if (!prompt?.trim()) {
        throw new Error('prompt is required for Creative Studio');
      }
      const endpoint = `${base}/api/v2/video/creative-studio/generate`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: videoClusterHeaders(true),
        body: JSON.stringify(buildCreativeStudioJson(body)),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(
          `Aurora Creative Studio failed: ${res.status}${errText ? ` — ${errText.slice(0, 400)}` : ''}`
        );
      }
      const json = await readJsonRecord(res);
      const raw = firstImageFromResponse(json);
      if (!raw) {
        throw new Error('Aurora Creative Studio returned no images');
      }
      return await normalizeImageForUploadPipeline(raw);
    }

    const brief = (body.lifestyle_brief ?? body.prompt).trim();
    if (!brief) {
      throw new Error('brief (or prompt) is required for Lifestyle Gen');
    }

    const endpoint = `${base}/api/v2/video/lifestyle-gen/generate`;
    const fd = buildLifestyleFormData(body);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: videoClusterHeaders(false),
      body: fd,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Aurora Lifestyle Gen failed: ${res.status}${errText ? ` — ${errText.slice(0, 400)}` : ''}`
      );
    }
    const json = await readJsonRecord(res);
    const raw = firstImageFromResponse(json);
    if (!raw) {
      throw new Error('Aurora Lifestyle Gen returned no images');
    }
    return await normalizeImageForUploadPipeline(raw);
  }
}
