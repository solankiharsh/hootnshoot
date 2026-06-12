import { Injectable } from '@nestjs/common';

const MODEL = 'gemini-2.5-flash-image';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiImageEditRequest {
  prompt: string;
  imageBase64: string;
  imageMimeType?: string;
}

export interface GeminiImageEditResult {
  imageBase64: string;
  mimeType: string;
}

interface GeminiInlineDataPart {
  inlineData: { mimeType: string; data: string };
}
interface GeminiTextPart {
  text: string;
}
type GeminiPart = GeminiInlineDataPart | GeminiTextPart;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

@Injectable()
export class GeminiImageEditProvider {
  async edit(req: GeminiImageEditRequest): Promise<GeminiImageEditResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[GeminiImageEditProvider] GEMINI_API_KEY is not set');
      throw new Error('Gemini image edit failed: missing API key');
    }

    const url = `${GEMINI_BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;
    const mimeType = req.imageMimeType ?? 'image/png';

    const body = {
      contents: [
        {
          parts: [
            { text: req.prompt },
            { inlineData: { mimeType, data: req.imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    };

    console.log(`[GeminiImageEditProvider] POST model=${MODEL} prompt="${req.prompt.slice(0, 80)}..."`);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('[GeminiImageEditProvider] Network error:', err);
      throw new Error('Gemini image edit failed: network error');
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '(unreadable)');
      console.error(
        `[GeminiImageEditProvider] HTTP ${response.status}`,
        '\nBody:',
        errBody
      );
      throw new Error(`Gemini image edit failed: HTTP ${response.status}`);
    }

    let data: GeminiResponse;
    try {
      data = (await response.json()) as GeminiResponse;
    } catch (err) {
      console.error('[GeminiImageEditProvider] Failed to parse response:', err);
      throw new Error('Gemini image edit failed: invalid response body');
    }

    if (data.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini image edit blocked: ${data.promptFeedback.blockReason}`
      );
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find(
      (p): p is GeminiInlineDataPart => 'inlineData' in p
    );

    if (!inline) {
      console.error(
        '[GeminiImageEditProvider] No image in response. candidates:',
        JSON.stringify(data.candidates).slice(0, 500)
      );
      throw new Error('Gemini image edit failed: no image returned');
    }

    return {
      imageBase64: inline.inlineData.data,
      mimeType: inline.inlineData.mimeType,
    };
  }
}
