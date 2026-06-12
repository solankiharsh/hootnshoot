'use client';

import React, { FC, useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { DatePicker } from '@gitroom/frontend/components/launches/helpers/date.picker';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { loadLanguageRouting } from '@gitroom/frontend/components/settings/language-routing.component';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import clsx from 'clsx';

const LANGUAGES = [
  { code: 'es', label: 'Spanish (ES)' },
  { code: 'pt', label: 'Portuguese (PT)' },
  { code: 'ar', label: 'Arabic (AR)' },
  { code: 'fr', label: 'French (FR)' },
] as const;

type LangCode = 'es' | 'pt' | 'ar' | 'fr';

type VariantStatus = 'idle' | 'running' | 'done' | 'error';

interface VariantState {
  accountId: string;
  date: dayjs.Dayjs;
  checked: boolean;
  status: VariantStatus;
  error?: string;
}

export const LaunchVariantsModal: FC<{
  postGroup: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ postGroup, onClose, onSuccess }) => {
  const t = useT();
  const fetch = useFetch();
  const { data: integrations = [] } = useIntegrationList();

  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [mediaItem, setMediaItem] = useState<{ id: string; path: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const defaultDate = newDayjs().add(1, 'day').startOf('hour');

  const [variants, setVariants] = useState<Record<LangCode, VariantState>>(() => {
    const routing = loadLanguageRouting();
    const initial: Record<LangCode, VariantState> = {} as any;
    for (const { code } of LANGUAGES) {
      initial[code] = {
        accountId: routing[code] || '',
        date: defaultDate,
        checked: false,
        status: 'idle',
      };
    }
    return initial;
  });

  // Load post data
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await (await fetch(`/posts/group/${postGroup}`)).json();
        if (!active) return;
        const firstPost = data.posts?.[0];
        if (firstPost) {
          setCaption(firstPost.content || '');
          const firstMedia = firstPost.image?.[0] || null;
          setMediaItem(firstMedia ? { id: firstMedia.id, path: firstMedia.path } : null);
          // Pre-fill dates from the post's publish date
          const postDate = newDayjs(firstPost.publishDate);
          setVariants((prev) => {
            const next = { ...prev };
            for (const code of Object.keys(next) as LangCode[]) {
              next[code] = { ...next[code], date: postDate };
            }
            return next;
          });
        }
      } catch {
        // fallback: proceed with empty caption
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [postGroup]);

  const updateVariant = useCallback((code: LangCode, patch: Partial<VariantState>) => {
    setVariants((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  }, []);

  const handleSubmit = async () => {
    const checkedCodes = (Object.keys(variants) as LangCode[]).filter(
      (code) => variants[code].checked
    );
    if (checkedCodes.length === 0) {
      setGlobalError('Select at least one language.');
      return;
    }
    const missing = checkedCodes.filter((code) => !variants[code].accountId);
    if (missing.length > 0) {
      setGlobalError(`Please select an account for: ${missing.join(', ').toUpperCase()}`);
      return;
    }
    setGlobalError('');
    setSubmitting(true);

    // Mark all checked as running
    setVariants((prev) => {
      const next = { ...prev };
      for (const code of checkedCodes) {
        next[code] = { ...next[code], status: 'running' };
      }
      return next;
    });

    await Promise.all(
      checkedCodes.map(async (code) => {
        const { accountId, date } = variants[code];
        try {
          // 1. Translate caption
          let translatedCaption = caption;
          if (caption.trim()) {
            try {
              const res = await fetch('/media/translate-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: caption, targetLanguage: code }),
              });
              const data = await res.json();
              translatedCaption = (data?.response ?? caption).trim() || caption;
            } catch {
              translatedCaption = caption;
            }
          }

          // 2. Create post
          const group = makeId(10);
          const payload = {
            type: 'schedule',
            publishWhenApproved: true,
            tags: [] as string[],
            shortLink: false,
            date: date.utc().format('YYYY-MM-DDTHH:mm:ss'),
            posts: [
              {
                integration: { id: accountId },
                group,
                settings: {},
                value: [
                  {
                    content: translatedCaption,
                    delay: 0,
                    image: mediaItem ? [{ id: mediaItem.id, path: mediaItem.path }] : [],
                  },
                ],
              },
            ],
          };
          const res = await fetch('/posts', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const msg = await res.text().catch(() => `HTTP ${res.status}`);
            throw new Error(msg || `HTTP ${res.status}`);
          }
          updateVariant(code, { status: 'done' });
        } catch (err) {
          updateVariant(code, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed',
          });
        }
      })
    );

    setSubmitting(false);
    onSuccess();
    // Close after short delay to let the user see the done states
    setTimeout(onClose, 1200);
  };

  const checkedCount = (Object.keys(variants) as LangCode[]).filter(
    (c) => variants[c].checked
  ).length;

  return (
    <div className="flex flex-col gap-[20px] p-[4px]">
      {/* Header info */}
      <div className="flex flex-col gap-[6px]">
        <div className="text-[13px] text-textItemBlur">
          {t('launch_variants_description', 'Create translated copies of this post for other language markets. Each variant will be submitted for compliance review.')}
        </div>
        {mediaItem && (
          <div className="flex items-center gap-[10px] mt-[4px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaItem.path}
              alt="Post image"
              className="w-[48px] h-[48px] rounded-[6px] object-cover border border-newTableBorder"
            />
            <div className="text-[12px] text-textItemBlur line-clamp-2 flex-1">
              {caption || t('no_content', 'No caption')}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-[13px] text-textItemBlur animate-pulse">
          {t('loading', 'Loading post…')}
        </div>
      ) : (
        <div className="flex flex-col gap-[16px]">
          {LANGUAGES.map(({ code, label }) => {
            const variant = variants[code];
            const isRunning = variant.status === 'running';
            const isDone = variant.status === 'done';
            const isError = variant.status === 'error';
            return (
              <div
                key={code}
                className={clsx(
                  'border rounded-[8px] p-[14px] flex flex-col gap-[12px] transition-colors',
                  variant.checked
                    ? 'border-btnPrimary/40 bg-btnPrimary/5'
                    : 'border-newTableBorder',
                  (isRunning || isDone || isError) && 'opacity-90'
                )}
              >
                <div className="flex items-center gap-[10px]">
                  <input
                    type="checkbox"
                    id={`lang-${code}`}
                    checked={variant.checked}
                    disabled={submitting}
                    onChange={(e) => updateVariant(code, { checked: e.target.checked })}
                    className="w-[16px] h-[16px] accent-btnPrimary cursor-pointer"
                  />
                  <label
                    htmlFor={`lang-${code}`}
                    className="text-[14px] font-[600] text-newTextColor cursor-pointer flex-1"
                  >
                    {label}
                  </label>
                  {isRunning && (
                    <span className="inline-block w-[14px] h-[14px] border-2 border-textItemBlur border-t-btnPrimary rounded-full animate-spin" />
                  )}
                  {isDone && (
                    <span className="text-green-400 text-[12px] font-[600]">✓ Done</span>
                  )}
                  {isError && (
                    <span className="text-red-400 text-[12px]">✗ {variant.error}</span>
                  )}
                </div>

                {variant.checked && (
                  <div className="flex flex-col gap-[10px] pl-[26px]">
                    {/* Account picker */}
                    <div>
                      <div className="text-[11px] font-[600] text-textItemBlur uppercase tracking-wide mb-[4px]">
                        {t('account', 'Account')}
                      </div>
                      <select
                        value={variant.accountId}
                        disabled={submitting}
                        onChange={(e) => updateVariant(code, { accountId: e.target.value })}
                        className="w-full bg-newBgColorInner border border-newTableBorder rounded-[6px] px-[10px] py-[7px] text-[13px] text-newTextColor outline-none"
                      >
                        <option value="">{t('select_account', '— Select account —')}</option>
                        {integrations.map((integration: any) => (
                          <option key={integration.id} value={integration.id}>
                            {integration.name || integration.identifier}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date picker */}
                    <div>
                      <div className="text-[11px] font-[600] text-textItemBlur uppercase tracking-wide mb-[4px]">
                        {t('schedule_date', 'Schedule Date')}
                      </div>
                      <DatePicker
                        date={variant.date}
                        onChange={(d) => updateVariant(code, { date: d })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {globalError && (
        <p className="text-red-400 text-[13px]">{globalError}</p>
      )}

      <div className="flex gap-[10px] justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="cursor-pointer h-[40px] px-[18px] rounded-[6px] border border-newTableBorder text-[13px] text-textItemBlur hover:text-newTextColor hover:bg-boxHover transition-colors disabled:opacity-50"
        >
          {t('cancel', 'Cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || loading || checkedCount === 0}
          className={clsx(
            'h-[40px] px-[18px] rounded-[6px] text-[13px] font-[600] transition-all cursor-pointer',
            submitting || loading || checkedCount === 0
              ? 'bg-btnSimple text-textItemBlur cursor-not-allowed opacity-60'
              : 'bg-btnPrimary text-white hover:opacity-90'
          )}
        >
          {submitting
            ? t('scheduling', 'Scheduling…')
            : `${t('schedule_variants', 'Schedule')} ${checkedCount > 0 ? `${checkedCount} variant${checkedCount > 1 ? 's' : ''}` : 'variants'}`}
        </button>
      </div>
    </div>
  );
};
