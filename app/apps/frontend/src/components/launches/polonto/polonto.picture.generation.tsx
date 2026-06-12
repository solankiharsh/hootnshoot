'use client';

import React, { useCallback, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Clean } from '@blueprintjs/icons';
import { SectionTab } from 'openpolotno/side-panel';
import { getImageSize } from 'openpolotno/utils/image';
import { fitAndCenterOnPage } from 'openpolotno/utils/image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { AIEraseModal } from '@gitroom/frontend/components/launches/polonto/polonto.ai.erase';
import { AIEditModal } from '@gitroom/frontend/components/launches/polonto/polonto.ai.edit';
import {
  AIPanelHeader,
  AIPanelSection,
  AIToolCard,
  GENERATE_PROMPT_CHIPS,
  GenerateSkeleton,
  PrimaryAction,
  PromptChips,
  PromptField,
} from '@gitroom/frontend/components/launches/polonto/polonto.ai.shared';

const GenerateTab = observer(({ store }: { store: any }) => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { billingEnabled } = useVariables();
  const fetch = useFetch();
  const toast = useToaster();
  const t = useT();
  const [showErase, setShowErase] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const loadCredits = useCallback(async () => {
    if (!billingEnabled) {
      return { credits: 1000 };
    }
    return (await fetch('/billing/ai-credits', { method: 'GET' })).json();
  }, [billingEnabled, fetch]);

  const { data, mutate } = useSWR(['billing-ai-credits', 'ai_images'], loadCredits);

  const outOfCredits = (data?.credits ?? 0) <= 0;

  const handleGenerate = async () => {
    if (outOfCredits) {
      window.open('/billing', '_blank');
      return;
    }
    if (!prompt.trim()) {
      toast.show(t('type_prompt', 'Please type your prompt'), 'warning');
      return;
    }
    setLoading(true);
    setImage(null);
    try {
      const req = await fetch('/media/generate-image', {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!req.ok) {
        const body = await req.json().catch(() => ({}));
        const msg = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message || body.error || 'Image generation failed';
        toast.show(msg, 'warning');
        return;
      }
      mutate();
      const newData = await req.json();
      setImage(newData.output);
    } finally {
      setLoading(false);
    }
  };

  const addToCanvas = useCallback(
    async (src: string, pos?: { x: number; y: number }, element?: any) => {
      if (element?.type === 'svg' && element.contentEditable) {
        element.set({ maskSrc: src });
        return;
      }
      if (element?.type === 'image' && element.contentEditable) {
        element.set({ src });
        return;
      }
      const { width, height } = await getImageSize(src);
      const placement = fitAndCenterOnPage(store, width, height, pos);
      store.activePage?.addElement({ type: 'image', src, ...placement });
      toast.show(t('added_to_canvas', 'Added to canvas'), 'success');
    },
    [store, toast, t]
  );

  if (showErase) {
    return <AIEraseModal store={store} onClose={() => setShowErase(false)} />;
  }

  if (showEdit) {
    return <AIEditModal store={store} onClose={() => setShowEdit(false)} />;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-1 pb-4 text-gray-900">
      <AIPanelHeader
        title={t('ai_studio', 'AI Studio')}
        subtitle={t(
          'ai_studio_hint',
          'Generate images from text, then edit or erase objects.'
        )}
      />

      <AIPanelSection title={t('create', 'Create')}>
        <PromptField
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleGenerate}
          placeholder={t(
            'ai_prompt_placeholder',
            'Describe the image you want to create…'
          )}
          disabled={loading}
        />
        <PromptChips
          chips={GENERATE_PROMPT_CHIPS}
          onPick={setPrompt}
          disabled={loading}
        />
        <p className="text-[10px] text-gray-400 mt-2 mb-2">
          {t('ai_shortcut_hint', 'Tip: ⌘/Ctrl + Enter to generate')}
        </p>
        <PrimaryAction
          onClick={handleGenerate}
          loading={loading}
          disabled={!prompt.trim() && !outOfCredits}
        >
          {outOfCredits
            ? t('get_more_credits', 'Get more credits')
            : t('generate', 'Generate')}
        </PrimaryAction>
      </AIPanelSection>

      {(loading || image) && (
        <AIPanelSection title={t('result', 'Result')}>
          {loading && <GenerateSkeleton />}
          {!loading && image && (
            <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={() => addToCanvas(image)}
                className="group relative block w-full overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <img
                  src={image}
                  alt={t('generated_preview', 'Generated preview')}
                  loading="lazy"
                  className="w-full max-h-[220px] object-contain bg-[linear-gradient(45deg,#f9fafb_25%,transparent_25%)]"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/50 to-transparent py-3 text-[12px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {t('click_add_canvas', 'Click to add to canvas')}
                </span>
              </button>
            </div>
          )}
        </AIPanelSection>
      )}

      <AIPanelSection title={t('refine', 'Refine')} className="mt-auto pt-2 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-2">
          <AIToolCard
            title={t('edit_image', 'Edit Image')}
            description={t('edit_image_desc', 'Change style, lighting, or details')}
            accent="violet"
            onClick={() => setShowEdit(true)}
          />
          <AIToolCard
            title={t('erase_objects', 'Erase Objects')}
            description={t('erase_objects_desc', 'Paint over areas to remove')}
            accent="rose"
            onClick={() => setShowErase(true)}
          />
        </div>
      </AIPanelSection>
    </div>
  );
});

const PictureGeneratorPanel = observer(({ store }: { store: any }) => (
  <div className="h-full min-h-0">
    <GenerateTab store={store} />
  </div>
));

export const PictureGeneratorSection = {
  name: 'picture-generator-ai',
  Tab: (props: any) => (
    <SectionTab name="AI Img" {...props}>
      <Clean />
    </SectionTab>
  ),
  Panel: PictureGeneratorPanel,
};
