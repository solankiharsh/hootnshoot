import { Injectable } from '@nestjs/common';
import { jsonrepair } from 'jsonrepair';

const MODEL = 'gemini-2.5-pro';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiVisionJsonRequest {
  prompt: string;
  imageBase64: string;
  imageMimeType?: string;
  responseSchema?: Record<string, unknown>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

@Injectable()
export class GeminiVisionProvider {
  async generateJson<T = unknown>(req: GeminiVisionJsonRequest): Promise<T> {
    try {
      return await this.callOnce<T>(req);
    } catch (err) {
      if (err instanceof Error && err.message.includes('invalid JSON output')) {
        console.warn('[GeminiVisionProvider] JSON parse failed, retrying once');
        return await this.callOnce<T>(req);
      }
      throw err;
    }
  }

  private async callOnce<T>(req: GeminiVisionJsonRequest): Promise<T> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini vision failed: missing GEMINI_API_KEY');
    }

    const mimeType = req.imageMimeType ?? 'image/png';
    const url = `${GEMINI_BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;

    const generationConfig: Record<string, unknown> = {
      responseMimeType: 'application/json',
      temperature: 0,
    };
    if (req.responseSchema) generationConfig.responseSchema = req.responseSchema;

    const body = {
      contents: [
        {
          parts: [
            { text: req.prompt },
            { inlineData: { mimeType, data: req.imageBase64 } },
          ],
        },
      ],
      generationConfig,
    };

    console.log(
      `[GeminiVisionProvider] POST model=${MODEL} prompt="${req.prompt.slice(0, 80)}..."`
    );
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('[GeminiVisionProvider] Network error:', err);
      throw new Error('Gemini vision failed: network error');
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '(unreadable)');
      console.error(
        `[GeminiVisionProvider] HTTP ${response.status}`,
        '\nBody:',
        errBody
      );
      throw new Error(`Gemini vision failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini vision blocked: ${data.promptFeedback.blockReason}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error(
        '[GeminiVisionProvider] No text in response. candidates:',
        JSON.stringify(data.candidates).slice(0, 500)
      );
      throw new Error('Gemini vision failed: no text in response');
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // Try brace-balanced extraction first (handles trailing garbage)
      const extracted = extractJsonObject(text);
      const candidate = extracted ?? text;
      try {
        const repaired = jsonrepair(candidate);
        console.warn('[GeminiVisionProvider] direct parse failed, jsonrepair recovered');
        return JSON.parse(repaired) as T;
      } catch {
        /* fall through */
      }
      console.error('[GeminiVisionProvider] Failed to parse JSON:', text.slice(0, 800));
      throw new Error('Gemini vision failed: invalid JSON output');
    }
  }
}

function extractJsonObject(text: string): string | null {
  let start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}
