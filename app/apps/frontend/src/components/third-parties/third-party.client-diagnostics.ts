'use client';

export const THIRD_PARTY_LOG_COMPONENT = 'third_party';

export type ThirdPartyClientLogLevel = 'info' | 'warn' | 'error';

export function safeIntegrationRowSnapshot(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') {
    return { rowKind: typeof row };
  }
  const r = row as Record<string, unknown>;
  const rawId = r.id != null ? String(r.id) : '';
  const trimmed = rawId.trim();
  return {
    keys: Object.keys(r).sort().join(','),
    identifier: typeof r.identifier === 'string' ? r.identifier : undefined,
    position: typeof r.position === 'string' ? r.position : undefined,
    title: typeof r.title === 'string' ? r.title : undefined,
    hasNonEmptyId: trimmed.length > 0,
    idLength: rawId.length,
  };
}

export function safeThirdPartyContextSnapshot(ctx: unknown): Record<string, unknown> {
  if (!ctx || typeof ctx !== 'object') {
    return { contextKind: typeof ctx };
  }
  const c = ctx as Record<string, unknown>;
  const rawId = c.id != null ? String(c.id) : '';
  const trimmed = rawId.trim();
  return {
    keys: Object.keys(c).sort().join(','),
    identifier: typeof c.identifier === 'string' ? c.identifier : undefined,
    hasNonEmptyId: trimmed.length > 0,
    idLength: rawId.length,
  };
}

export function logThirdPartyClient(
  event: string,
  status: string,
  details: Record<string, unknown> = {},
  level: ThirdPartyClientLogLevel = 'info'
): void {
  const payload = {
    component: THIRD_PARTY_LOG_COMPONENT,
    event,
    status,
    ts: new Date().toISOString(),
    ...details,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(`[hootnshoot] ${line}`);
  } else if (level === 'warn') {
    console.warn(`[hootnshoot] ${line}`);
  } else {
    console.info(`[hootnshoot] ${line}`);
  }

  if (level === 'info') {
    return;
  }

  void import('@sentry/nextjs')
    .then((Sentry) => {
      if (typeof Sentry.getClient === 'function' && !Sentry.getClient()) {
        return;
      }
      Sentry.captureMessage(`${THIRD_PARTY_LOG_COMPONENT}.${event}`, {
        level: level === 'error' ? 'error' : 'warning',
        tags: {
          component: THIRD_PARTY_LOG_COMPONENT,
          event,
          status,
        },
        extra: details,
      });
    })
    .catch(() => {});
}
