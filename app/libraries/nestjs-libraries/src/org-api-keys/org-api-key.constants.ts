export interface OrgApiKeyMeta {
  label: string;
  description: string;
  // Env vars checked (in order) when an organization has not configured its own key
  envVars: string[];
  docsUrl: string;
}

export const ORG_API_KEYS: Record<string, OrgApiKeyMeta> = {
  'late-api': {
    label: 'Late API',
    description:
      'Connects managed social channels (Facebook, Instagram, X, LinkedIn, TikTok, YouTube and more) through getlate.dev.',
    envVars: ['LATE_API_KEY'],
    docsUrl: 'https://getlate.dev',
  },
  openai: {
    label: 'OpenAI',
    description: 'AI content generation and image generation.',
    envVars: ['OPENAI_API_KEY'],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    label: 'Google Gemini',
    description: 'AI image editing and caption generation.',
    envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  replicate: {
    label: 'Replicate',
    description: 'AI object erase and image models.',
    envVars: ['REPLICATE_API_TOKEN'],
    docsUrl: 'https://replicate.com/account/api-tokens',
  },
};

export type OrgApiKeyIdentifier = keyof typeof ORG_API_KEYS;

export const ORG_API_KEY_IDENTIFIERS = Object.keys(ORG_API_KEYS);

export function isOrgApiKeyIdentifier(value: string): value is OrgApiKeyIdentifier {
  return value in ORG_API_KEYS;
}
