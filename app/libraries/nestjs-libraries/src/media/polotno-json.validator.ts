import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 50;
const MAX_ELEMENTS_PER_PAGE = 500;
const MAX_TEXT_LENGTH = 10_000;
const MAX_NESTING_DEPTH = 12;

const ALLOWED_ELEMENT_TYPES = [
  'text',
  'image',
  'svg',
  'figure',
  'line',
  'video',
  'gif',
  'group',
] as const;

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').slice(0, MAX_TEXT_LENGTH);
}

const safeSrc = z
  .string()
  .max(2048)
  .superRefine((val, ctx) => {
    if (val.startsWith('data:image/')) {
      if (val.length > 500_000) {
        ctx.addIssue({ code: 'custom', message: 'Embedded image data URL too large' });
      }
      return;
    }
    if (val.startsWith('/')) {
      return;
    }
    try {
      const u = new URL(val);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        ctx.addIssue({ code: 'custom', message: 'Invalid asset URL protocol' });
      }
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid asset URL' });
    }
  });

const elementBase = z
  .object({
    id: z.string().max(64).optional(),
    type: z.enum(ALLOWED_ELEMENT_TYPES),
    name: z.string().max(256).optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().finite().optional(),
    height: z.number().finite().optional(),
    rotation: z.number().finite().optional(),
    opacity: z.number().min(0).max(1).optional(),
    visible: z.boolean().optional(),
    selectable: z.boolean().optional(),
    draggable: z.boolean().optional(),
    text: z.string().max(MAX_TEXT_LENGTH).optional(),
    src: safeSrc.optional(),
    maskSrc: safeSrc.optional(),
    fill: z.string().max(64).optional(),
    stroke: z.string().max(64).optional(),
    fontFamily: z.string().max(128).optional(),
    fontSize: z.number().finite().optional(),
    custom: z.record(z.unknown()).optional(),
  })
  .passthrough();

type PolotnoElementInput = z.infer<typeof elementBase> & {
  children?: PolotnoElementInput[];
};

const polotnoElement: z.ZodType<PolotnoElementInput> = z.lazy(() =>
  elementBase.extend({
    children: z.array(polotnoElement).max(MAX_ELEMENTS_PER_PAGE).optional(),
  })
);

const polotnoPage = z.object({
  id: z.string().max(64),
  children: z.array(polotnoElement).max(MAX_ELEMENTS_PER_PAGE),
  width: z.union([z.number().finite(), z.literal('auto')]).optional(),
  height: z.union([z.number().finite(), z.literal('auto')]).optional(),
  background: z.string().max(64).optional(),
});

const polotnoStoreSchema = z.object({
  width: z.number().finite().positive().max(10_000),
  height: z.number().finite().positive().max(10_000),
  fonts: z
    .array(
      z.object({
        fontFamily: z.string().max(128),
        url: safeSrc.optional(),
      })
    )
    .max(100)
    .optional(),
  pages: z.array(polotnoPage).min(1).max(MAX_PAGES),
  unit: z.enum(['px', 'pt', 'in', 'cm', 'mm']).optional(),
  dpi: z.number().finite().positive().max(600).optional(),
  schemaVersion: z.number().int().nonnegative().optional(),
});

function countElements(
  elements: PolotnoElementInput[],
  depth: number
): number {
  if (depth > MAX_NESTING_DEPTH) {
    throw new BadRequestException('Template nesting depth exceeds limit');
  }
  let count = 0;
  for (const el of elements) {
    count += 1;
    if (count > MAX_ELEMENTS_PER_PAGE * MAX_PAGES) {
      throw new BadRequestException('Template has too many elements');
    }
    if (el.type === 'text' && typeof el.text === 'string') {
      el.text = stripHtml(el.text);
    }
    if (el.children?.length) {
      count += countElements(el.children, depth + 1);
    }
  }
  return count;
}

export function validatePolotnoJson(input: unknown): Record<string, unknown> {
  const serialized = JSON.stringify(input ?? null);
  if (serialized.length > MAX_JSON_BYTES) {
    throw new BadRequestException('Template JSON exceeds size limit');
  }

  const parsed = polotnoStoreSchema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException('Invalid template structure');
  }

  for (const page of parsed.data.pages) {
    countElements(page.children as PolotnoElementInput[], 0);
  }

  return parsed.data as Record<string, unknown>;
}
