'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { PolontoMediaPicker } from '@gitroom/frontend/components/launches/polonto/polonto.media.picker';
import {
  AIBackBar,
  AIErrorBanner,
  AIPanelSection,
  ImageCompareFrame,
  PrimaryAction,
  PromptChips,
  PromptField,
} from '@gitroom/frontend/components/launches/polonto/polonto.ai.shared';
import { fitAndCenterOnPage } from 'openpolotno/utils/image';

const PROMPT_SUGGESTIONS = [
  'Change the background to a sunset sky',
  'Add dramatic cinematic lighting',
  'Make it look like a vintage photograph',
  'Apply a warm golden hour color grade',
] as const;

export function AIEditModal({ store, onClose }: { store: any; onClose: () => void }) {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fetch = useFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const selected = store?.activePage?.children?.find(
      (el: any) => el.type === 'image' && !el.contentEditable
    );
    if (selected?.src) {
      setSourceImage(selected.src);
      setShowUploader(false);
    }
  }, [store]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(reader.result as string);
      setShowUploader(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleEdit = useCallback(async () => {
    if (!prompt.trim() || !sourceImage) return;
    setIsProcessing(true);
    setError('');
    setResultDataUrl(null);
    try {
      const res = await fetch('/media/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          imageDataUrl: sourceImage,
          prompt: prompt.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || 'Edit failed');
      }
      const { base64 } = await res.json();
      if (!base64) throw new Error('No image returned');
      setResultDataUrl(`data:image/png;base64,${base64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setIsProcessing(false);
    }
  }, [prompt, sourceImage, fetch]);

  const handleApply = useCallback(() => {
    if (!resultDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const placement = fitAndCenterOnPage(
        store,
        img.naturalWidth || img.width,
        img.naturalHeight || img.height
      );
      store.activePage?.addElement({
        type: 'image',
        src: resultDataUrl,
        ...placement,
      });
      onClose();
    };
    img.src = resultDataUrl;
  }, [resultDataUrl, store, onClose]);

  if (showUploader) {
    return (
      <div className="flex h-full flex-col overflow-y-auto px-1 pb-4">
        <AIBackBar label="Edit image" onBack={onClose} />
        <p className="text-[12px] text-gray-500 mb-3 leading-snug">
          Choose from your library, upload a file, or select an image on the canvas.
        </p>
        <PolontoMediaPicker
          onSelect={(dataUrl) => {
            setSourceImage(dataUrl);
            setShowUploader(false);
          }}
        />
        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[11px] text-gray-400 uppercase tracking-wide">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <label
          htmlFor="edit-upload"
          className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-[13px] font-medium text-gray-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors"
        >
          Upload from device
        </label>
        <input
          id="edit-upload"
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden px-1 pb-2">
      <AIBackBar label="Edit image" onBack={onClose} />

      <div className="flex gap-2 mb-3 min-h-0 flex-1">
        <ImageCompareFrame label="Original" src={sourceImage} />
        <ImageCompareFrame
          label="Result"
          src={resultDataUrl}
          emptyLabel="Preview appears after edit"
          loading={isProcessing}
        />
      </div>

      <AIPanelSection>
        <PromptField
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleEdit}
          placeholder="Describe the edits you want…"
          disabled={isProcessing}
          rows={2}
        />
        <PromptChips chips={PROMPT_SUGGESTIONS} onPick={setPrompt} disabled={isProcessing} />
      </AIPanelSection>

      {error && <AIErrorBanner message={error} />}

      <div className="flex gap-2 mt-auto pt-2 [&>button]:flex-1">
        {resultDataUrl ? (
          <>
            <PrimaryAction
              variant="secondary"
              onClick={() => {
                setResultDataUrl(null);
                handleEdit();
              }}
              loading={isProcessing}
              disabled={isProcessing}
            >
              Regenerate
            </PrimaryAction>
            <PrimaryAction variant="success" onClick={handleApply}>
              Apply to canvas
            </PrimaryAction>
          </>
        ) : (
          <PrimaryAction onClick={handleEdit} loading={isProcessing} disabled={!prompt.trim()}>
            {isProcessing ? 'Editing…' : 'Run edit'}
          </PrimaryAction>
        )}
      </div>
    </div>
  );
}
