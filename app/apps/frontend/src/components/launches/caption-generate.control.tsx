'use client';

import { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import { Wand2 } from 'lucide-react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';

export type CaptionGenContentType = 'academy' | 'announcement' | 'campaign';

export interface GeneratedCaptionPayload {
  headline: string;
  body: string;
  hashtags: string;
}

const CONTENT_OPTIONS: { value: CaptionGenContentType; label: string }[] = [
  { value: 'academy', label: 'Academy' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'announcement', label: 'Announcement' },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CAPTION_DISCLAIMER_PARAGRAPHS: string[] = [];

export function captionResultToHtml(result: GeneratedCaptionPayload): string {
  const parts: string[] = [];
  if (result.headline.trim()) {
    parts.push(`<p>${escapeHtml(result.headline.trim())}</p>`);
  }
  if (result.body.trim()) {
    parts.push(
      `<p>${escapeHtml(result.body.trim()).replace(/\n/g, '<br>')}</p>`
    );
  }
  if (result.hashtags.trim()) {
    parts.push(`<p>${escapeHtml(result.hashtags.trim())}</p>`);
  }
  for (const para of CAPTION_DISCLAIMER_PARAGRAPHS) {
    parts.push(`<p>${escapeHtml(para)}</p>`);
  }
  return parts.join('');
}

const inputClass =
  'w-full bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[14px] py-[10px] text-newTextColor text-[14px] placeholder-textItemBlur focus:outline-none focus:border-btnPrimary transition-colors cursor-text';

const labelClass =
  'block text-[12px] font-[600] text-textItemBlur mb-[6px] uppercase tracking-wide';

const CaptionGenerateForm: FC<{
  close: () => void;
  onSuccess: (payload: GeneratedCaptionPayload) => void;
}> = ({ close, onSuccess }) => {
  const fetch = useFetch();
  const t = useT();
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] =
    useState<CaptionGenContentType>('academy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      setError(
        t('caption_topic_required', 'Briefly describe your topics to continue.')
      );
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/caption/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          contentType,
          language: 'en',
        }),
      });
      if (!res.ok) {
        throw new Error('Generation failed');
      }
      const data: GeneratedCaptionPayload = await res.json();
      onSuccess(data);
      close();
    } catch {
      setError(
        t('caption_generate_error', 'Something went wrong. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }, [topic, contentType, fetch, onSuccess, close, t]);

  return (
    <div className="flex flex-col gap-[16px] p-[4px]">
      <p className="text-[13px] text-textItemBlur leading-[1.5]">
        {t(
          'caption_generate_intro',
          'Describe the topics in a few words. Pick a content type, then generate a caption you can edit before posting.'
        )}
      </p>
      <div>
        <label className={labelClass} htmlFor="caption-gen-topic">
          {t('caption_topic_label', 'Topics')}
        </label>
        <textarea
          id="caption-gen-topic"
          rows={4}
          className={clsx(inputClass, 'resize-none')}
          placeholder={t(
            'caption_topic_placeholder',
            'e.g. New MT5 stocks, partner webinar next week, Q2 CPA promotion'
          )}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={loading}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="caption-gen-type">
          {t('caption_content_type', 'Content type')}
        </label>
        <select
          id="caption-gen-type"
          className={clsx(inputClass, 'cursor-pointer')}
          value={contentType}
          onChange={(e) =>
            setContentType(e.target.value as CaptionGenContentType)
          }
          disabled={loading}
        >
          {CONTENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-red-400 text-[13px]">{error}</p>
      ) : null}
      <div className="flex gap-[10px] justify-end pt-[4px]">
        <Button type="button" className="cursor-pointer" onClick={close}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          className="cursor-pointer"
          loading={loading}
          onClick={handleGenerate}
        >
          {t('generate_caption', 'Generate caption')}
        </Button>
      </div>
    </div>
  );
};

export const CaptionGenerateControl: FC<{
  onCaptionReady: (payload: GeneratedCaptionPayload) => void;
}> = ({ onCaptionReady }) => {
  const modals = useModals();
  const t = useT();

  const open = useCallback(() => {
    modals.openModal({
      title: t('caption_generate_modal_title', 'Generate caption'),
      size: '560px',
      children: (close) => (
        <CaptionGenerateForm close={close} onSuccess={onCaptionReady} />
      ),
    });
  }, [modals, onCaptionReady, t]);

  return (
    <button
      type="button"
      onClick={open}
      className="cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px] border-0"
      aria-label={t('create_caption', 'Create caption')}
      data-tooltip-id="tooltip"
      data-tooltip-content={t('create_caption', 'Create caption')}
    >
      <div className="flex gap-[5px] items-center">
        <Wand2 size={14} className="shrink-0 opacity-90" aria-hidden />
        <div className="text-[10px] font-[600] iconBreak:hidden block">
          {t('generate_caption', 'Generate caption')}
        </div>
      </div>
    </button>
  );
};
