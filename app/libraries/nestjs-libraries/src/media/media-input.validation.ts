import { BadRequestException } from '@nestjs/common';

export const MAX_BASE64_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AI_PROMPT_LENGTH = 2000;

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function assertPromptLength(prompt: unknown, field = 'prompt'): string {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new BadRequestException(`${field} is required`);
  }
  const trimmed = prompt.trim();
  if (trimmed.length > MAX_AI_PROMPT_LENGTH) {
    throw new BadRequestException(
      `${field} must be at most ${MAX_AI_PROMPT_LENGTH} characters`
    );
  }
  return trimmed;
}

export function decodeBase64Image(dataUrlOrBase64: string): Buffer {
  if (typeof dataUrlOrBase64 !== 'string' || !dataUrlOrBase64.trim()) {
    throw new BadRequestException('Invalid base64 image data');
  }

  const base64 = dataUrlOrBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!base64 || base64.length % 4 !== 0 || !BASE64_RE.test(base64)) {
    throw new BadRequestException('Invalid base64 image data');
  }

  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > MAX_BASE64_IMAGE_BYTES) {
    throw new BadRequestException(
      `Image exceeds ${MAX_BASE64_IMAGE_BYTES / (1024 * 1024)}MB limit`
    );
  }

  const buf = Buffer.from(base64, 'base64');
  if (buf.length > MAX_BASE64_IMAGE_BYTES) {
    throw new BadRequestException(
      `Image exceeds ${MAX_BASE64_IMAGE_BYTES / (1024 * 1024)}MB limit`
    );
  }

  return buf;
}
