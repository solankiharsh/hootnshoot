import { createHmac, timingSafeEqual } from 'node:crypto';

const HMAC_ALG = 'sha256';
const MAX_TOKEN_AGE_MS = 30 * 60 * 1000;

export type Gener8JobTokenPayload = {
  jobId: string;
  integrationId: string;
  organizationId: string;
  iat: number;
};

function signingSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s?.trim()) {
    throw new Error('JWT_SECRET is not configured');
  }
  return s;
}

export function signGener8JobToken(
  payload: Omit<Gener8JobTokenPayload, 'iat'> & { iat?: number }
): string {
  const full: Gener8JobTokenPayload = {
    ...payload,
    iat: payload.iat ?? Date.now(),
  };
  const body = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  const sig = createHmac(HMAC_ALG, signingSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGener8JobToken(token: string): Gener8JobTokenPayload {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) {
    throw new Error('Invalid job token');
  }
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac(HMAC_ALG, signingSecret())
    .update(body)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid job token');
  }
  let parsed: Gener8JobTokenPayload;
  try {
    parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as Gener8JobTokenPayload;
  } catch {
    throw new Error('Invalid job token');
  }
  if (
    !parsed.jobId ||
    typeof parsed.jobId !== 'string' ||
    !parsed.integrationId ||
    typeof parsed.integrationId !== 'string' ||
    !parsed.organizationId ||
    typeof parsed.organizationId !== 'string' ||
    typeof parsed.iat !== 'number'
  ) {
    throw new Error('Invalid job token');
  }
  if (Date.now() - parsed.iat > MAX_TOKEN_AGE_MS) {
    throw new Error('Job token expired');
  }
  return parsed;
}
