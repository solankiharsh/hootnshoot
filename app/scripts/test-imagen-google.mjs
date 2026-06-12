#!/usr/bin/env node
/**
 * Test Google Imagen via Gemini API (same key as GEMINI_API_KEY in .env).
 * Usage: node -r ../load-env.cjs scripts/test-imagen-google.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey?.trim()) {
  console.error('FAIL: GEMINI_API_KEY (or GOOGLE_API_KEY) not set');
  process.exit(1);
}

const prompt = 'A simple red circle on a white background, flat design, test image';
const models = [
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-generate-001',
  'imagen-3.0-generate-002',
];

const outDir = join(__dirname, '../.local/imagen-test');
mkdirSync(outDir, { recursive: true });

async function testImagen(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim(),
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '1:1' },
    }),
  });
  const elapsed = Date.now() - started;
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    return {
      model,
      ok: false,
      status: res.status,
      elapsed,
      error: json?.error?.message || text.slice(0, 500),
    };
  }

  const predictions = json?.predictions || json?.generatedImages || [];
  const first = predictions[0];
  const b64 =
    first?.bytesBase64Encoded ||
    first?.image?.bytesBase64Encoded ||
    first?.imageBytes ||
    json?.generatedImages?.[0]?.image?.imageBytes;

  if (!b64) {
    return {
      model,
      ok: false,
      status: res.status,
      elapsed,
      error: 'No image bytes in response',
      keys: json ? Object.keys(json) : [],
      sample: JSON.stringify(json).slice(0, 300),
    };
  }

  const outPath = join(outDir, `${model.replace(/\./g, '-')}.png`);
  writeFileSync(outPath, Buffer.from(b64, 'base64'));
  return {
    model,
    ok: true,
    status: res.status,
    elapsed,
    outPath,
    bytes: Buffer.from(b64, 'base64').length,
  };
}

async function testGeminiNativeImage() {
  const model = 'gemini-2.0-flash-preview-image-generation';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'A simple blue square on white background' }] }],
      generationConfig: { responseModalities: ['image', 'text'] },
    }),
  });
  const elapsed = Date.now() - started;
  const text = await res.text();
  if (!res.ok) {
    return { model, ok: false, status: res.status, elapsed, error: text.slice(0, 400) };
  }
  const json = JSON.parse(text);
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    return { model, ok: false, status: res.status, elapsed, error: 'No inline image in response' };
  }
  const outPath = join(outDir, 'gemini-native-image.png');
  writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, 'base64'));
  return { model, ok: true, status: res.status, elapsed, outPath, bytes: imagePart.inlineData.data.length };
}

console.log('=== Google image generation test ===\n');
console.log('Key source: GEMINI_API_KEY or GOOGLE_API_KEY (loaded via load-env.cjs)\n');

for (const model of models) {
  const result = await testImagen(model);
  console.log(JSON.stringify(result, null, 2));
  console.log('');
}

console.log('--- Gemini native image (what AI Edit uses in Hootnshoot) ---\n');
const geminiEdit = await testGeminiNativeImage();
console.log(JSON.stringify(geminiEdit, null, 2));

console.log('\n--- Hootnshoot Design Media mapping ---');
console.log('generate-image (/media/generate-image) -> OpenAI DALL-E 3 (OPENAI_API_KEY)');
console.log('edit-image (/media/edit-image)       -> Gemini generateContent + image modality (GEMINI_API_KEY)');
console.log('erase-image                          -> Replicate (REPLICATE_API_TOKEN)');
console.log('Aurora integration                   -> imagen4 | gemini | mix via AURORA_API_KEY (not GEMINI directly)');
