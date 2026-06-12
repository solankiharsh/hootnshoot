'use client';

import React, { useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFeatureFlags } from '@gitroom/frontend/components/launches/helpers/use.feature.flags';

interface PreviewResult {
  verdict: 'ok' | 'warning' | 'rejected';
  bannedWordHits: string[];
  threshold: number;
  enabled: boolean;
}

export const CompliancePreviewBanner: React.FC<{
  caption: string;
  platform?: string;
}> = ({ caption, platform }) => {
  const t = useT();
  const fetch = useFetch();
  const { complianceEnabled } = useFeatureFlags();
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!complianceEnabled) return;
    if (!caption || caption.trim().length === 0) {
      setResult(null);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch('/compliance/preview', {
          method: 'POST',
          body: JSON.stringify({ caption, platform }),
        });
        if (r.ok) setResult((await r.json()) as PreviewResult);
      } finally {
        setLoading(false);
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [caption, platform, complianceEnabled, fetch]);

  if (!complianceEnabled) return null;
  if (!result || !result.enabled) return null;

  const tone =
    result.verdict === 'rejected'
      ? 'bg-red-500/10 border-red-500 text-red-200'
      : result.verdict === 'warning'
        ? 'bg-yellow-500/10 border-yellow-500 text-yellow-200'
        : 'bg-green-500/10 border-green-500 text-green-200';

  const label =
    result.verdict === 'rejected'
      ? t('compliance_preview_rejected', 'Likely rejected')
      : result.verdict === 'warning'
        ? t('compliance_preview_warning', 'Warnings')
        : t('compliance_preview_ok', 'Looks good');

  return (
    <div className={`border rounded-[6px] p-[10px] text-[12px] flex flex-col gap-[4px] ${tone}`}>
      <div className="flex items-center gap-[8px]">
        <div className="font-[600]">{label}</div>
        {loading && (
          <div className="h-[10px] w-[10px] rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
      </div>
      {result.bannedWordHits.length > 0 && (
        <div className="opacity-80">
          {t('compliance_preview_hits', 'Banned-word hits:')}{' '}
          <span className="font-mono">{result.bannedWordHits.join(', ')}</span>
        </div>
      )}
    </div>
  );
};
