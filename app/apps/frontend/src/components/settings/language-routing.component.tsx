'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const LS_KEY = 'hs_language_routing';

export type LanguageRouting = { es?: string; pt?: string; ar?: string; fr?: string };

export const loadLanguageRouting = (): LanguageRouting => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
};

const LANGUAGES = [
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'fr', label: 'French', native: 'Français' },
] as const;

const LanguageRoutingComponent = () => {
  const t = useT();
  const toaster = useToaster();
  const { data: integrations = [] } = useIntegrationList();
  const [routing, setRouting] = useState<LanguageRouting>({});

  useEffect(() => {
    setRouting(loadLanguageRouting());
  }, []);

  const handleChange = useCallback((code: string, integrationId: string) => {
    setRouting((prev) => ({ ...prev, [code]: integrationId || undefined }));
  }, []);

  const handleSave = useCallback(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(routing));
    toaster.show(t('settings_updated', 'Settings updated'), 'success');
  }, [routing, toaster, t]);

  return (
    <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[24px]">
      <div className="mt-[4px]">{t('language_routing', 'Language Routing')}</div>
      <div className="text-[12px] text-customColor18">
        {t(
          'language_routing_description',
          'Map each language to a default social account for "Launch Variants". When launching translated variants, the chosen account is pre-selected.'
        )}
      </div>
      <div className="flex flex-col gap-[12px]">
        {LANGUAGES.map(({ code, label, native }) => (
          <div key={code} className="flex items-center justify-between gap-[24px]">
            <div className="flex flex-col flex-1">
              <div className="text-[14px]">
                {label}{' '}
                <span className="text-customColor18 text-[12px]">({native})</span>
              </div>
            </div>
            <div className="w-[240px]">
              <select
                value={routing[code as keyof LanguageRouting] || ''}
                onChange={(e) => handleChange(code, e.target.value)}
                className="w-full bg-input border border-fifth rounded-[4px] px-[10px] py-[7px] text-[13px] text-white outline-none"
              >
                <option value="">{t('select_account', '— Select account —')}</option>
                {integrations.map((integration: any) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name || integration.identifier}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="cursor-pointer h-[36px] px-[20px] rounded-[4px] bg-white text-black text-[13px] font-[500] hover:bg-white/90"
        >
          {t('save', 'Save')}
        </button>
      </div>
    </div>
  );
};

export default LanguageRoutingComponent;
