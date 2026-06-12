import sharp from 'sharp';

interface SamplerBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SamplerInput {
  imageBase64: string;
  imageWidth: number;
  imageHeight: number;
  box: SamplerBox;
}

const MIN_DIM = 6;

export async function sampleTextColor(
  input: SamplerInput
): Promise<string | undefined> {
  const { imageBase64, imageWidth, imageHeight, box } = input;

  const left = clamp(Math.round(box.x), 0, Math.max(0, imageWidth - 1));
  const top = clamp(Math.round(box.y), 0, Math.max(0, imageHeight - 1));
  const width = clamp(Math.round(box.width), 1, imageWidth - left);
  const height = clamp(Math.round(box.height), 1, imageHeight - top);

  if (width < MIN_DIM || height < MIN_DIM) return undefined;

  let raw: { data: Buffer; info: sharp.OutputInfo };
  try {
    raw = await sharp(Buffer.from(imageBase64, 'base64'))
      .extract({ left, top, width, height })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    console.warn(
      `[text-color-sampler] sharp.extract failed (${left},${top} ${width}x${height}):`,
      (err as Error).message
    );
    return undefined;
  }

  const { data, info } = raw;
  const channels = info.channels;
  if (channels < 3) return undefined;
  const numPixels = info.width * info.height;
  if (numPixels === 0) return undefined;

  const luminance = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const threshold = otsuThreshold(luminance);

  let belowCount = 0;
  let aboveCount = 0;
  for (let i = 0; i < numPixels; i++) {
    if (luminance[i] < threshold) belowCount++;
    else aboveCount++;
  }

  const textIsDark = belowCount <= aboveCount;

  const sampleIndices: number[] = [];
  for (let i = 0; i < numPixels; i++) {
    if (textIsDark ? luminance[i] < threshold : luminance[i] >= threshold) {
      sampleIndices.push(i);
    }
  }
  if (sampleIndices.length < 8) return undefined;

  sampleIndices.sort((a, b) =>
    textIsDark ? luminance[a] - luminance[b] : luminance[b] - luminance[a]
  );
  const coreCount = Math.max(8, Math.floor(sampleIndices.length * 0.3));
  const core = sampleIndices.slice(0, coreCount);

  const rArr: number[] = [];
  const gArr: number[] = [];
  const bArr: number[] = [];
  for (const i of core) {
    rArr.push(data[i * channels]);
    gArr.push(data[i * channels + 1]);
    bArr.push(data[i * channels + 2]);
  }

  const r = median(rArr);
  const g = median(gArr);
  const b = median(bArr);
  return rgbToHex(r, g, b);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function otsuThreshold(luminance: Float32Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < luminance.length; i++) {
    hist[clamp(Math.round(luminance[i]), 0, 255)]++;
  }
  const total = luminance.length;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVar = -1;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }

  return threshold;
}
