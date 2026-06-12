import { Injectable } from '@nestjs/common';
import {
  CaptionBrief,
  CaptionResult,
  CaptionService,
} from './caption.service.interface';

const MODEL = 'gemini-2.5-pro';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

@Injectable()
export class GeminiCaptionAdapter extends CaptionService {
  async generate(brief: CaptionBrief): Promise<CaptionResult> {
    const apiKey = process.env.GEMINI_API_KEY;

    // ── 1. Key presence check ──────────────────────────────────────────────
    if (!apiKey) {
      console.error('[GeminiCaptionAdapter] GEMINI_API_KEY is not set in environment');
      throw new Error('Caption generation failed: missing API key');
    }
    console.log(`[GeminiCaptionAdapter] Using model: ${MODEL}`);

    const url = `${GEMINI_BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;

    const prompt = `You are a B2B social-media copywriter for a partner/affiliate program. Captions are addressed TO partners (affiliates, introducing brokers), NEVER to end customers.

VOICE RULES (non-negotiable):
- Use second person — "you", "your community", "your audience", "your referrals". Address the partner directly.
- NEVER use first-person voice. Banned phrases: "I", "I've", "I'm", "I just", "my", "we'd love", "let me know what you think".
- NEVER write vague filler. Banned phrases: "some exciting", "new stuff", "check it out", "let me know", "amazing things", "many opportunities".
- ALWAYS name specific assets, features, or concrete numbers. If the topic mentions a category (stocks, forex, crypto, indices) but does not list specific instruments, INVENT 4-5 well-known real examples that fit the category. For NYSE/NASDAQ stocks use names like AMC, BlackBerry (BB), GameStop (GME), Rivian (RIVN), SMCI, NVIDIA, Tesla. For forex use majors like EUR/USD, GBP/USD, USD/JPY. For crypto use BTC, ETH, SOL.

BODY STRUCTURE (the "body" JSON field must contain exactly this layout, paragraphs joined with \\n\\n):
1. Hook line — one sentence ending with one emoji. Energetic and partner-facing.
2. Context paragraph — 2-3 sentences. Open with "As a partner," when natural. Name the specific assets / platform / feature.
3. Action paragraph — 2 sentences. How partners can use this with their referrals.
4. The exact heading line "What this can mean for you:" — then three bullets on separate lines, each starting with "• " (U+2022 + space). Bullet format: "• <Short Bold-style Phrase>: <one-sentence concrete benefit>".
5. Final CTA sentence — imperative ("Share…", "Promote…", "Help your audience…"). One sentence only.

CONTENT-TYPE RHYTHM (applied on top of the structure above):
- announcement: news-driven, something just launched. Words like "just added", "now live", "today".
- academy: educational. Open with a question or insight about a knowledge gap. Bullets describe what partners learn to teach their audience.
- campaign: promotional and time-sensitive. Name the offer / push / event. Bullets describe earnings, opportunities, or limited-time advantages.

HASHTAGS RULES:
- Start with 1-2 brand/program-relevant hashtags, then 4-5 topic-specific hashtags, space-separated. No generic hashtags like #AffiliateMarketing, #Fintech, or #Trading unless the topic IS those.

FEW-SHOT EXAMPLE — this is the quality and structure bar. Match this exactly in voice, length, specificity, and rhythm.
Input topic: "New Equities: NYSE & NASDAQ 🚀"
Input contentType: "announcement"
Expected JSON output:
{
  "headline": "New Equities: NYSE & NASDAQ 🚀",
  "body": "Expand your community's horizons with Wall Street's finest! 📈\\n\\nAs a partner, your growth is fueled by variety. We've just added a powerhouse lineup of globally recognised stocks, including high-impact assets like AMC, BlackBerry (BB), GameStop (GME), Rivian (RIVN), and SMCI.\\n\\nShow your community how to gain real-market exposure with the reliability they expect. Whether your referrals are looking to potentially capitalise on the latest tech trends or the next big \\"meme stock\\" movement, the platform provides the infrastructure they need to trade these leading names on both demo and real accounts.\\n\\nWhat this can mean for you:\\n• More Assets = More Activity: A broader portfolio keeps your clients engaged and trading more frequently.\\n• Easy to Promote: Familiar names and a trusted platform mean less friction for your referrals.\\n• Higher Commission Potential: New opportunities for them lead to daily and monthly potential payouts for you.\\n\\nShare the news with your audience and help them explore these new assets today!",
  "hashtags": "#Partners #TradingStrategy #StockMarket #NYSE #NASDAQ #MT5"
}

NOW GENERATE for:
Topic: ${brief.topic}
Content type: ${brief.contentType}

Return ONLY a single JSON object with keys "headline", "body", "hashtags" — matching the example's voice, structure, length, and specificity. No markdown fences, no explanation, no disclaimer or risk-warning text. The disclaimer is appended by the application.`;

    // ── Build optional additional instructions block ───────────────────────
    const additionalLines: string[] = [];
    if (brief.keyMessage?.trim()) {
      additionalLines.push(`- Key message to emphasise: ${brief.keyMessage.trim()}. Make sure the body clearly reinforces this angle.`);
    }
    if (brief.assets?.trim()) {
      additionalLines.push(`- Specific assets or products to mention by name: ${brief.assets.trim()}. Reference these explicitly in the body — do not use generic terms like "stocks" or "assets" when specific names are provided.`);
    }
    if (brief.cta?.trim()) {
      additionalLines.push(`- Preferred call to action style: ${brief.cta.trim()}. The final CTA sentence should reflect this.`);
    }
    if (brief.tone?.trim()) {
      additionalLines.push(`- Tone: ${brief.tone.trim()}. Apply this throughout — Urgent means time-sensitive language, Casual means conversational, Professional means formal benefit-focused.`);
    }

    const fullPrompt = additionalLines.length > 0
      ? `${prompt}\n\nAdditional instructions based on user input:\n${additionalLines.join('\n')}`
      : prompt;

    // ── 2. HTTP request ────────────────────────────────────────────────────
    console.log(`[GeminiCaptionAdapter] POST ${GEMINI_BASE_URL}/${MODEL}:generateContent`);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6,
            responseSchema: {
              type: 'OBJECT',
              properties: {
                headline: { type: 'STRING' },
                body: { type: 'STRING' },
                hashtags: { type: 'STRING' },
              },
              required: ['headline', 'body', 'hashtags'],
              propertyOrdering: ['headline', 'body', 'hashtags'],
            },
          },
        }),
      });
    } catch (networkErr) {
      console.error('[GeminiCaptionAdapter] Network error reaching Gemini API:', networkErr);
      throw new Error('Caption generation failed: network error');
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
        `[GeminiCaptionAdapter] Gemini API returned HTTP ${response.status} ${response.statusText}`,
        '\nResponse body:', errorBody
      );
      throw new Error(`Caption generation failed: HTTP ${response.status} ${response.statusText}`);
    }

    // ── 4. Parse Gemini response envelope ─────────────────────────────────
    let data: any;
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error('[GeminiCaptionAdapter] Failed to parse Gemini response as JSON:', parseErr);
      throw new Error('Caption generation failed: invalid response from Gemini');
    }

    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!rawText) {
      console.error('[GeminiCaptionAdapter] Gemini response contained no text. Full response:', JSON.stringify(data));
      throw new Error('Caption generation failed: empty response from Gemini');
    }

    // ── 5. Strip markdown fences and parse caption JSON ───────────────────
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    console.log('[GeminiCaptionAdapter] Raw text from Gemini (first 200 chars):', cleaned.slice(0, 200));

    let parsed: CaptionResult;
    try {
      parsed = JSON.parse(cleaned) as CaptionResult;
    } catch (jsonErr) {
      console.error(
        '[GeminiCaptionAdapter] Failed to parse caption JSON from Gemini output.',
        '\nCleaned text:', cleaned,
        '\nParse error:', jsonErr
      );
      throw new Error('Caption generation failed: could not parse JSON from Gemini response');
    }

    // ── 6. Return raw fields — disclaimer is appended by the renderer ─────
    return {
      headline: parsed.headline,
      body: parsed.body,
      hashtags: parsed.hashtags,
    };
  }
}
