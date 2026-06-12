import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '/Users/harshsolanki/Developer/hootnshoot/.env' });
dotenv.config({ path: '/Users/harshsolanki/Developer/hootnshoot/app/.env', override: false });

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('REPLICATE_API_TOKEN not loaded');
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not loaded');
  process.exit(1);
}
console.log(
  `[test] REPLICATE_API_TOKEN=${process.env.REPLICATE_API_TOKEN.slice(0, 8)}... GEMINI_API_KEY=${process.env.GEMINI_API_KEY.slice(0, 8)}...`
);

import { ReplicateProvider } from '@gitroom/nestjs-libraries/3rdparties/replicate/replicate.provider';
import { GeminiImageEditProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-image-edit.provider';
import { GeminiVisionProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-vision.provider';
import { OcrAdapter } from '@gitroom/nestjs-libraries/templates/stages/ocr.adapter';
import { InpaintAdapter } from '@gitroom/nestjs-libraries/templates/stages/inpaint.adapter';
import { SubjectDetectAdapter } from '@gitroom/nestjs-libraries/templates/stages/subject-detect.adapter';
import { SubjectIsolateAdapter } from '@gitroom/nestjs-libraries/templates/stages/subject-isolate.adapter';
import { AccentDetectAdapter } from '@gitroom/nestjs-libraries/templates/stages/accent-detect.adapter';
import { QualityCheckService } from '@gitroom/nestjs-libraries/templates/quality/quality-check.service';
import { StageCacheService } from '@gitroom/nestjs-libraries/templates/stages/stage-cache.service';
import { TemplateDecomposeService } from '@gitroom/nestjs-libraries/templates/template-decompose.service';

async function main() {
  const imagePath = process.env.TEST_IMAGE || '/Users/harshsolanki/Downloads/creative-review-channel-images/Post 2 ROW.png';
  const buf = fs.readFileSync(imagePath);
  const imageBase64 = buf.toString('base64');
  console.log(`[test] loaded image ${path.basename(imagePath)} (${buf.length} bytes)`);

  const replicate = new ReplicateProvider();
  const gemini = new GeminiImageEditProvider();
  const vision = new GeminiVisionProvider();
  const ocr = new OcrAdapter(vision);
  const subjectDetect = new SubjectDetectAdapter(vision, replicate);
  const subjectIsolate = new SubjectIsolateAdapter(replicate);
  const inpaint = new InpaintAdapter(gemini, replicate);
  const accentDetect = new AccentDetectAdapter(vision);
  const quality = new QualityCheckService(vision);
  const stageCache = new StageCacheService();
  const service = new TemplateDecomposeService(
    ocr,
    subjectDetect,
    subjectIsolate,
    inpaint,
    accentDetect,
    quality,
    stageCache
  );

  const t0 = Date.now();
  const decomposeResult = await service.decompose({
    imageBase64,
    imageMimeType: 'image/png',
    strategies: { subjectDetect: 'gemini-then-dino', subjectIsolate: 'sam2-prompted' },
  });
  const result = decomposeResult.template;
  const report = decomposeResult.quality;
  const elapsedMs = Date.now() - t0;

  const outDir = '/tmp/decompose-result';
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = `${outDir}/template.json`;
  fs.writeFileSync(jsonPath, JSON.stringify(decomposeResult, null, 2));
  console.log(
    `[test] quality score=${report.score} issues=${report.issues.length} tierBRan=${report.tierBRan}`
  );
  for (const issue of report.issues) {
    console.log(`  [${issue.severity}] ${issue.code} ${issue.layer ? `(${issue.layer})` : ''}: ${issue.message}`);
  }

  const saveDataUrl = (src: string, file: string) => {
    const m = src.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return false;
    fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
    return true;
  };

  let subjectIdx = 0;
  for (const c of result.pages[0]?.children ?? []) {
    const el = c as any;
    if (el.type !== 'image' || typeof el.src !== 'string' || !el.src.startsWith('data:')) continue;
    if (el.name === 'Background') {
      saveDataUrl(el.src, `${outDir}/background.png`);
      console.log(`[test] saved background plate → ${outDir}/background.png`);
    } else {
      subjectIdx++;
      const safe = (el.name ?? 'subject').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const p = `${outDir}/subject-${subjectIdx}-${safe}.png`;
      saveDataUrl(el.src, p);
      console.log(`[test] saved subject (${el.box?.x ?? el.x},${el.y}) ${el.width}x${el.height} → ${p}`);
    }
  }

  console.log(`[test] decompose completed in ${elapsedMs}ms`);
  console.log(`[test] page size: ${result.width}x${result.height}`);
  console.log(`[test] children count: ${result.pages[0].children.length}`);
  console.log(`[test] children types:`, result.pages[0].children.map((c: any) => `${c.type}:${c.name}`).join(', '));
  console.log(`[test] full JSON → ${jsonPath}`);
}

main().catch((err) => {
  console.error('[test] FAILED:', err);
  process.exit(1);
});
