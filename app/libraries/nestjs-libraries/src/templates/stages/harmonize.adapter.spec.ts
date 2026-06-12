import sharp from 'sharp';
import { HarmonizeAdapter } from './harmonize.adapter';
import { SubjectMask, BackgroundPlate } from '../templates.types';

// Helper: create a solid-color PNG as a data URL
async function solidPng(
  r: number, g: number, b: number,
  width = 32, height = 32,
  alpha = true
): Promise<string> {
  const channels = alpha ? 4 : 3;
  const data = Buffer.alloc(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    data[i * channels] = r;
    data[i * channels + 1] = g;
    data[i * channels + 2] = b;
    if (alpha) data[i * channels + 3] = 255;
  }
  const buf = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

describe('HarmonizeAdapter', () => {
  let adapter: HarmonizeAdapter;
  let mockGemini: { edit: jest.Mock };

  beforeEach(() => {
    mockGemini = { edit: jest.fn() };
    adapter = new HarmonizeAdapter(mockGemini as any);
  });

  describe('harmonize()', () => {
    it('returns subjects unchanged when list is empty', async () => {
      const bg: BackgroundPlate = { url: await solidPng(200, 200, 200, 64, 64, false) };
      const result = await adapter.harmonize([], bg);
      expect(result).toEqual([]);
    });

    it('returns subjects unchanged when background url is empty', async () => {
      const subUrl = await solidPng(100, 50, 50);
      const subject: SubjectMask = { url: subUrl, box: { x: 0, y: 0, width: 32, height: 32 } };
      const result = await adapter.harmonize([subject], { url: '' });
      expect(result).toEqual([subject]);
    });

    it('sets harmonized=true and harmonyScore on each subject', async () => {
      // Identical color → BC=1.0 → LUT path only, no Gemini
      const subUrl = await solidPng(128, 128, 128);
      const bgUrl = await solidPng(128, 128, 128, 64, 64, false);
      const subject: SubjectMask = {
        url: subUrl,
        box: { x: 0, y: 0, width: 32, height: 32 },
        label: 'widget',
      };
      const result = await adapter.harmonize([subject], { url: bgUrl });
      expect(result).toHaveLength(1);
      expect(result[0].harmonized).toBe(true);
      expect(typeof result[0].harmonyScore).toBe('number');
      expect(result[0].harmonyScore).toBeGreaterThanOrEqual(0);
      expect(result[0].harmonyScore).toBeLessThanOrEqual(1);
      expect(mockGemini.edit).not.toHaveBeenCalled();
    });

    it('does NOT call Gemini when harmony score is above threshold', async () => {
      // Identical colours → BC very close to 1
      const subUrl = await solidPng(120, 120, 120);
      const bgUrl = await solidPng(120, 120, 120, 64, 64, false);
      const subject: SubjectMask = { url: subUrl, box: { x: 0, y: 0, width: 32, height: 32 } };
      const result = await adapter.harmonize([subject], { url: bgUrl });
      expect(mockGemini.edit).not.toHaveBeenCalled();
      expect(result[0].harmonized).toBe(true);
    });

    it('calls Gemini when harmony score is below threshold after LUT', async () => {
      // Force a low harmony environment: vivid red subject on cold blue background
      const subUrl = await solidPng(255, 0, 0);              // vivid red
      const bgUrl = await solidPng(0, 0, 200, 64, 64, false); // deep blue

      // Return a plausible Gemini edit (neutral grey composite)
      const refinedCompositeUrl = await solidPng(100, 100, 100, 64, 64, false);
      const refinedBase64 = refinedCompositeUrl.replace(/^data:[^;]+;base64,/, '');
      mockGemini.edit.mockResolvedValue({ imageBase64: refinedBase64, mimeType: 'image/png' });

      const subject: SubjectMask = {
        url: subUrl,
        box: { x: 0, y: 0, width: 32, height: 32 },
        label: 'redThing',
      };
      const result = await adapter.harmonize([subject], { url: bgUrl });
      expect(mockGemini.edit).toHaveBeenCalledTimes(1);
      expect(result[0].harmonized).toBe(true);
    });

    it('returns original subject if harmonization throws (safe fallback)', async () => {
      const badUrl = 'data:image/png;base64,NOTVALIDBASE64!!';
      const bgUrl = await solidPng(128, 128, 128, 64, 64, false);
      const subject: SubjectMask = { url: badUrl, box: { x: 0, y: 0, width: 32, height: 32 } };
      const result = await adapter.harmonize([subject], { url: bgUrl });
      expect(result[0]).toBe(subject); // same reference — untouched
    });
  });
});
