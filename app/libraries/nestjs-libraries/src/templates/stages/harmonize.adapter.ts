import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { GeminiImageEditProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-image-edit.provider';
import { BackgroundPlate, SubjectMask } from '../templates.types';

interface ChannelStats {
  means: [number, number, number];
  stds: [number, number, number];
}

@Injectable()
export class HarmonizeAdapter {
  constructor(private readonly gemini: GeminiImageEditProvider) {}

  async harmonize(
    subjects: SubjectMask[],
    background: BackgroundPlate
  ): Promise<SubjectMask[]> {
    if (!subjects.length || !background.url) return subjects;
    // Only handle data-URL backgrounds (keep-source plain URLs are already matched)
    if (!background.url.startsWith('data:')) return subjects;

    const threshold = parseFloat(process.env['HARMONY_THRESHOLD'] ?? '0.65');
    const bgStats = await this.extractStats(background.url);

    return Promise.all(
      subjects.map(async (subject) => {
        if (!subject.url.startsWith('data:')) return subject;
        try {
          // Score the ORIGINAL subject vs background to decide if Gemini is needed.
          // Reinhard transfer always matches first-order stats, so scoring post-LUT
          // would be trivially high for any input — scoring pre-LUT measures true mismatch.
          const originalScore = await this.bhattacharyyaCoefficient(subject.url, background.url);
          const lutUrl = await this.reinhardTransfer(subject.url, bgStats);
          console.log(
            `[HarmonizeAdapter] "${subject.label}" originalScore=${originalScore.toFixed(3)} threshold=${threshold}`
          );

          if (originalScore >= threshold) {
            return { ...subject, url: lutUrl, harmonyScore: originalScore, harmonized: true };
          }

          console.log(`[HarmonizeAdapter] "${subject.label}" below threshold — triggering Gemini refinement`);
          const refinedUrl = await this.geminiRefine(lutUrl, subject, background.url);
          const refinedScore = await this.bhattacharyyaCoefficient(refinedUrl, background.url);
          return { ...subject, url: refinedUrl, harmonyScore: refinedScore, harmonized: true };
        } catch (err) {
          console.warn(`[HarmonizeAdapter] harmonize failed for "${subject.label}":`, err);
          return subject;
        }
      })
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async extractStats(dataUrl: string): Promise<ChannelStats> {
    const buf = dataUrlToBuffer(dataUrl);
    const { data, info } = await sharp(buf)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const ch = info.channels;
    const count = info.width * info.height;
    const means: [number, number, number] = [0, 0, 0];
    const stds: [number, number, number] = [0, 0, 0];

    for (let i = 0; i < data.length; i += ch) {
      means[0] += data[i];
      means[1] += data[i + 1];
      means[2] += data[i + 2];
    }
    means[0] /= count; means[1] /= count; means[2] /= count;

    for (let i = 0; i < data.length; i += ch) {
      stds[0] += (data[i]     - means[0]) ** 2;
      stds[1] += (data[i + 1] - means[1]) ** 2;
      stds[2] += (data[i + 2] - means[2]) ** 2;
    }
    stds[0] = Math.sqrt(stds[0] / count);
    stds[1] = Math.sqrt(stds[1] / count);
    stds[2] = Math.sqrt(stds[2] / count);

    return { means, stds };
  }

  private async reinhardTransfer(subjectUrl: string, bgStats: ChannelStats): Promise<string> {
    const buf = dataUrlToBuffer(subjectUrl);
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Compute subject stats on RGB only (skip alpha channel at index 3)
    const count = info.width * info.height;
    const sMeans: [number, number, number] = [0, 0, 0];
    const sStds: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      sMeans[0] += data[i]; sMeans[1] += data[i + 1]; sMeans[2] += data[i + 2];
    }
    sMeans[0] /= count; sMeans[1] /= count; sMeans[2] /= count;
    for (let i = 0; i < data.length; i += 4) {
      sStds[0] += (data[i]     - sMeans[0]) ** 2;
      sStds[1] += (data[i + 1] - sMeans[1]) ** 2;
      sStds[2] += (data[i + 2] - sMeans[2]) ** 2;
    }
    sStds[0] = Math.sqrt(sStds[0] / count);
    sStds[1] = Math.sqrt(sStds[1] / count);
    sStds[2] = Math.sqrt(sStds[2] / count);

    // Reinhard transfer: shift mean + scale std per channel; leave alpha unchanged
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const scale = sStds[c] > 0 ? bgStats.stds[c] / sStds[c] : 1;
        const v = (data[i + c] - sMeans[c]) * scale + bgStats.means[c];
        data[i + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }

    const outBuf = await sharp(Buffer.from(data.buffer), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    return `data:image/png;base64,${outBuf.toString('base64')}`;
  }

  private async bhattacharyyaCoefficient(subjectUrl: string, bgUrl: string): Promise<number> {
    const [subHist, bgHist] = await Promise.all([
      this.buildNormHist(subjectUrl),
      this.buildNormHist(bgUrl),
    ]);

    let totalBC = 0;
    for (let c = 0; c < 3; c++) {
      let bc = 0;
      for (let b = 0; b < 256; b++) bc += Math.sqrt(subHist[c][b] * bgHist[c][b]);
      totalBC += bc;
    }
    return totalBC / 3;
  }

  private async buildNormHist(dataUrl: string): Promise<[number[], number[], number[]]> {
    const buf = dataUrlToBuffer(dataUrl);
    const { data, info } = await sharp(buf)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hists: [number[], number[], number[]] = [
      new Array<number>(256).fill(0),
      new Array<number>(256).fill(0),
      new Array<number>(256).fill(0),
    ];
    const ch = info.channels;
    const count = info.width * info.height;

    for (let i = 0; i < data.length; i += ch) {
      hists[0][data[i]]++;
      hists[1][data[i + 1]]++;
      hists[2][data[i + 2]]++;
    }
    for (let c = 0; c < 3; c++) {
      for (let b = 0; b < 256; b++) hists[c][b] /= count;
    }
    return hists;
  }

  private async geminiRefine(
    lutSubjectUrl: string,
    subject: SubjectMask,
    bgUrl: string
  ): Promise<string> {
    const bgBuf = dataUrlToBuffer(bgUrl);
    const subBuf = dataUrlToBuffer(lutSubjectUrl);

    const compositeBuf = await sharp(bgBuf)
      .composite([{
        input: subBuf,
        left: Math.round(subject.box.x),
        top: Math.round(subject.box.y),
      }])
      .png()
      .toBuffer();

    const result = await this.gemini.edit({
      prompt:
        "Adjust the lighting and color temperature of the foreground object to naturally blend with the background scene. Preserve the object's shape, texture, and identity exactly. Only modify lighting, shadows, and color temperature.",
      imageBase64: compositeBuf.toString('base64'),
      imageMimeType: 'image/png',
    });

    const refinedBuf = Buffer.from(result.imageBase64, 'base64');

    // Crop out the subject region from the edited composite
    const subjectRegionBuf = await sharp(refinedBuf)
      .extract({
        left: Math.max(0, Math.round(subject.box.x)),
        top: Math.max(0, Math.round(subject.box.y)),
        width: Math.round(subject.box.width),
        height: Math.round(subject.box.height),
      })
      .toBuffer();

    // Re-apply the original alpha mask so the subject stays transparent
    const originalAlpha = await sharp(subBuf)
      .extractChannel('alpha')
      .toBuffer();

    const finalBuf = await sharp(subjectRegionBuf)
      .ensureAlpha()
      .joinChannel(originalAlpha)
      .png()
      .toBuffer();

    return `data:image/png;base64,${finalBuf.toString('base64')}`;
  }
}

function dataUrlToBuffer(url: string): Buffer {
  const match = url.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error(`HarmonizeAdapter: cannot decode non-data URL "${url.slice(0, 60)}"`);
  return Buffer.from(match[1], 'base64');
}
