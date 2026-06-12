import { Injectable } from '@nestjs/common';

const MODEL = 'gemini-3-flash-preview';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface CaptionSuggestion {
  keyMessage: string;
  assets: string;
  cta: 'Share with audience' | 'Drive signups' | 'Promote a feature' | 'No specific CTA';
  tone: 'Professional' | 'Casual' | 'Urgent';
}

@Injectable()
export class GeminiCaptionSuggestAdapter {
  async suggest(topic: string, contentType: string): Promise<CaptionSuggestion> {
    const apiKey = process.env.GEMINI_API_KEY;

    // ── 1. Key presence check ──────────────────────────────────────────────
    if (!apiKey) {
      console.error('[GeminiCaptionSuggestAdapter] GEMINI_API_KEY is not set in environment');
      throw new Error('Caption suggest failed: missing API key');
    }
    console.log(`[GeminiCaptionSuggestAdapter] POST ${GEMINI_BASE_URL}/${MODEL}:generateContent`);

    const url = `${GEMINI_BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;

    const prompt = `You are a creative assistant for a social media marketing team. Based on the topic and content type below, suggest values for optional caption fields.

Topic: ${topic}
Content type: ${contentType}

Return ONLY a valid JSON object. No markdown, no backticks, no explanation. Schema:
{
  "keyMessage": "One sentence capturing the single most important angle to emphasise for this topic. Be specific — reference actual product names, features, or figures if inferable from the topic.",
  "assets": "Comma-separated list of specific asset names, product names, or proper nouns relevant to this topic. Leave empty string if none are inferable.",
  "cta": "One of exactly these four values based on what fits best: 'Share with audience' | 'Drive signups' | 'Promote a feature' | 'No specific CTA'",
  "tone": "One of exactly these three values based on content type: 'Professional' | 'Casual' | 'Urgent'"
}`;

    // ── 2. HTTP request ────────────────────────────────────────────────────
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
    } catch (networkErr) {
      console.error('[GeminiCaptionSuggestAdapter] Network error reaching Gemini API:', networkErr);
      throw new Error('Caption suggest failed: network error');
    }

    // ── 3. HTTP status check ───────────────────────────────────────────────
    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = '(could not read error body)';
      }
      console.error(
        `[GeminiCaptionSuggestAdapter] Gemini API returned HTTP ${response.status} ${response.statusText}`,
        '\nResponse body:', errorBody
      );
      throw new Error(`Caption suggest failed: HTTP ${response.status} ${response.statusText}`);
    }

    // ── 4. Parse Gemini response envelope ─────────────────────────────────
    let data: any;
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error('[GeminiCaptionSuggestAdapter] Failed to parse Gemini response as JSON:', parseErr);
      throw new Error('Caption suggest failed: invalid response from Gemini');
    }

    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!rawText) {
      console.error('[GeminiCaptionSuggestAdapter] Gemini response contained no text. Full response:', JSON.stringify(data));
      throw new Error('Caption suggest failed: empty response from Gemini');
    }

    // ── 5. Strip markdown fences and parse JSON ────────────────────────────
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    console.log('[GeminiCaptionSuggestAdapter] Raw text from Gemini (first 200 chars):', cleaned.slice(0, 200));

    try {
      return JSON.parse(cleaned) as CaptionSuggestion;
    } catch (jsonErr) {
      console.error(
        '[GeminiCaptionSuggestAdapter] Failed to parse suggestion JSON from Gemini output.',
        '\nCleaned text:', cleaned,
        '\nParse error:', jsonErr
      );
      throw new Error('Caption suggest failed: could not parse JSON from Gemini response');
    }
  }
}
