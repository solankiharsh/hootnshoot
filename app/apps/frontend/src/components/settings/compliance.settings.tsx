'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';

interface ComplianceSettings {
  id: string;
  disabled: boolean;
  threshold: number;
  autoPublishOnApproval: boolean;
  bannedWords: string[];
}

interface SettingsResponse {
  settings: ComplianceSettings | null;
  routing: Record<string, { thresholdOverride?: number; enabled?: boolean }>;
}

const COMPLIANCE_PROVIDER_IDENTIFIERS = new Set([
  'instagram',
  'instagram-standalone',
  'instagram-late',
  'facebook',
  'facebook-late',
  'x',
  'twitter',
  'x-late',
  'tiktok',
  'tiktok-late',
  'linkedin',
  'linkedin-page',
  'linkedin-late',
]);

export const ComplianceSettingsPanel: React.FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();

  const loader = useCallback(async (): Promise<SettingsResponse> => {
    const r = await fetch('/compliance/settings');
    if (!r.ok) return { settings: null, routing: {} };
    return r.json();
  }, [fetch]);

  const { data, isLoading, mutate } = useSWR<SettingsResponse>(
    'compliance-settings',
    loader,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      fallbackData: { settings: null, routing: {} },
    }
  );

  const { data: integrations } = useIntegrationList();
  const compliancePlatforms = useMemo(() => {
    if (!Array.isArray(integrations)) return [];
    return integrations.filter((i: { identifier?: string }) =>
      COMPLIANCE_PROVIDER_IDENTIFIERS.has((i.identifier ?? '').toLowerCase())
    );
  }, [integrations]);

  const [threshold, setThreshold] = useState<number>(70);
  const [autoPublish, setAutoPublish] = useState<boolean>(false);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [bannedWordsText, setBannedWordsText] = useState<string>('');
  const [routing, setRouting] = useState<Record<string, { thresholdOverride?: number; enabled?: boolean }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setThreshold(data.settings?.threshold ?? 70);
    setAutoPublish(data.settings?.autoPublishOnApproval ?? false);
    setDisabled(data.settings?.disabled ?? false);
    setBannedWordsText((data.settings?.bannedWords ?? []).join('\n'));
    setRouting(data.routing ?? {});
  }, [data]);

  const handleConnect = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/compliance/settings', {
        method: 'POST',
        body: JSON.stringify({
          threshold: 70,
          autoPublishOnApproval: false,
          bannedWords: [],
          disabled: false,
        }),
      });
      toaster.show(t('compliance_connected', 'Compliance connected'), 'success');
      mutate();
    } finally {
      setSaving(false);
    }
  }, [fetch, mutate, toaster, t]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const bannedWords = bannedWordsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await fetch('/compliance/settings', {
        method: 'POST',
        body: JSON.stringify({
          threshold,
          autoPublishOnApproval: autoPublish,
          bannedWords,
          disabled,
        }),
      });
      toaster.show(t('compliance_saved', 'Compliance settings saved'), 'success');
      mutate();
    } finally {
      setSaving(false);
    }
  }, [fetch, threshold, autoPublish, disabled, bannedWordsText, mutate, toaster, t]);

  const handleRoutingSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/compliance/routing', {
        method: 'POST',
        body: JSON.stringify({ routing }),
      });
      toaster.show(t('routing_saved', 'Per-platform routing saved'), 'success');
      mutate();
    } finally {
      setSaving(false);
    }
  }, [fetch, routing, mutate, toaster, t]);

  if (isLoading) {
    return (
      <div className="my-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
        <div className="animate-pulse">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!data?.settings) {
    return (
      <div className="my-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
        <div className="text-[16px] font-[600]">
          {t('compliance_settings', 'Compliance Settings')}
        </div>
        <div className="text-[13px] text-customColor18">
          {t(
            'compliance_not_connected',
            'Content Cop compliance review is not yet configured for this workspace. Connect to enable per-platform rule profiles, auto-publish, and banned-word checks.'
          )}
        </div>
        <div>
          <Button onClick={handleConnect} loading={saving}>
            {t('compliance_connect', 'Connect Content Cop')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="my-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-[600]">
            {t('compliance_settings', 'Compliance Settings')}
          </div>
          <div
            className={`text-[12px] px-[8px] py-[4px] rounded-[4px] ${
              disabled
                ? 'bg-customColor18 text-textColor'
                : 'bg-btnPrimary text-white'
            }`}
          >
            {disabled
              ? t('compliance_disabled', 'Disabled')
              : t('compliance_connected_badge', 'Connected')}
          </div>
        </div>

        <div className="flex items-center justify-between gap-[24px]">
          <div className="flex flex-col flex-1">
            <div className="text-[14px]">
              {t('compliance_threshold', 'Approval threshold')}
            </div>
            <div className="text-[12px] text-customColor18">
              {t(
                'compliance_threshold_help',
                'Minimum compliance score (0-100) required to auto-approve. Scores below this require manual override.'
              )}
            </div>
          </div>
          <div className="w-[120px]">
            <Input
              name="threshold"
              type="number"
              label=""
              disableForm={true}
              removeError={true}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-[24px]">
          <div className="flex flex-col flex-1">
            <div className="text-[14px]">
              {t('compliance_auto_publish', 'Auto-publish on approval')}
            </div>
            <div className="text-[12px] text-customColor18">
              {t(
                'compliance_auto_publish_help',
                'When the post is approved by Content Cop, publish it automatically (no manual click).'
              )}
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoPublish}
            onChange={(e) => setAutoPublish(e.target.checked)}
            className="w-[20px] h-[20px]"
          />
        </div>

        <div className="flex items-center justify-between gap-[24px]">
          <div className="flex flex-col flex-1">
            <div className="text-[14px]">
              {t('compliance_disable', 'Pause compliance')}
            </div>
            <div className="text-[12px] text-customColor18">
              {t(
                'compliance_disable_help',
                'Temporarily skip compliance checks without disconnecting. Posts publish without review.'
              )}
            </div>
          </div>
          <input
            type="checkbox"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
            className="w-[20px] h-[20px]"
          />
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[14px]">
            {t('compliance_banned_words', 'Banned words (one per line)')}
          </div>
          <div className="text-[12px] text-customColor18">
            {t(
              'compliance_banned_words_help',
              'Posts containing any of these phrases are auto-rejected before submission to Content Cop.'
            )}
          </div>
          <textarea
            value={bannedWordsText}
            onChange={(e) => setBannedWordsText(e.target.value)}
            className="bg-customColor2 border border-customColor6 rounded-[4px] p-[8px] text-[13px] min-h-[100px] font-mono"
            placeholder="guaranteed returns&#10;risk-free&#10;..."
          />
        </div>

        <div>
          <Button onClick={handleSave} loading={saving}>
            {t('save', 'Save')}
          </Button>
        </div>
      </div>

      <div className="my-[8px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
        <div className="text-[16px] font-[600]">
          {t('compliance_routing', 'Per-platform routing')}
        </div>
        <div className="text-[13px] text-customColor18">
          {t(
            'compliance_routing_help',
            'Override the global threshold for specific connected platforms. Useful when some channels are stricter than others.'
          )}
        </div>
        {compliancePlatforms.length === 0 ? (
          <div className="text-[13px] text-customColor18 italic">
            {t(
              'compliance_routing_no_platforms',
              'No compliance-supported platforms connected yet. Connect Instagram, Facebook, X, TikTok, or LinkedIn to configure routing.'
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-[8px]">
              {compliancePlatforms.map((integration: { id: string; name: string; identifier: string }) => {
                const cfg = routing[integration.id] ?? {};
                return (
                  <div
                    key={integration.id}
                    className="flex items-center gap-[12px] py-[8px] border-b border-customColor6 last:border-b-0"
                  >
                    <div className="flex-1 text-[14px]">{integration.name}</div>
                    <div className="text-[12px] text-customColor18">
                      {t('compliance_routing_threshold', 'Threshold:')}
                    </div>
                    <div className="w-[80px]">
                      <Input
                        name={`threshold-${integration.id}`}
                        type="number"
                        label=""
                        disableForm={true}
                        removeError={true}
                        value={cfg.thresholdOverride ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setRouting((prev) => ({
                            ...prev,
                            [integration.id]: {
                              ...prev[integration.id],
                              thresholdOverride: raw === '' ? undefined : Number(raw),
                            },
                          }));
                        }}
                      />
                    </div>
                    <label className="flex items-center gap-[6px] text-[12px]">
                      <input
                        type="checkbox"
                        checked={cfg.enabled !== false}
                        onChange={(e) =>
                          setRouting((prev) => ({
                            ...prev,
                            [integration.id]: {
                              ...prev[integration.id],
                              enabled: e.target.checked,
                            },
                          }))
                        }
                      />
                      {t('compliance_routing_enabled', 'Enabled')}
                    </label>
                  </div>
                );
              })}
            </div>
            <div>
              <Button onClick={handleRoutingSave} loading={saving}>
                {t('save_routing', 'Save routing')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComplianceSettingsPanel;
