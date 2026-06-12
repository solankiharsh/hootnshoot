'use client';

import {
  createContext,
  FC,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createStore } from 'openpolotno/model/store';
import Workspace from 'openpolotno/canvas/workspace';
import { RaeditorContainer, SidePanelWrap, WorkspaceWrap } from 'openpolotno';
import { SidePanel, DEFAULT_SECTIONS } from 'openpolotno/side-panel';
import Toolbar from 'openpolotno/toolbar/toolbar';
import ZoomButtons from 'openpolotno/toolbar/zoom-buttons';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { PictureGeneratorSection } from '@gitroom/frontend/components/launches/polonto/polonto.picture.generation';
import { BrandAssetsSection } from '@gitroom/frontend/components/launches/polonto/supabase-brand-assets';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { setAPI } from 'openpolotno/utils/api';
import { setGoogleFontsVariants } from 'openpolotno/utils/fonts';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { fitDecomposedTextLayers } from '@gitroom/frontend/components/launches/polonto/fit-decomposed-text';

// Expand Google Fonts weight variants. The font list itself lives in
// openpolotno/src/utils/fonts.ts (600+ families) and is used directly
// without calling the polotno API — no API key is needed.
setGoogleFontsVariants('100,300,400,500,700,900,400italic,700italic');

const CloseContext = createContext({
  close: {} as any,
  setMedia: {} as any,
  initialJson: undefined as unknown,
  fullHeight: false,
});

const TRANSLATE_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
];

const ActionControls = ({ store }: any) => {
  const t = useT();
  const close = useContext(CloseContext);
  const [load, setLoad] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const fetch = useFetch();
  const toaster = useToaster();

  const duplicateForLanguage = async (langCode: string) => {
    setTranslating(langCode);

    const liveTextRefs: Array<{ el: any; original: string; originalAlign: string }> = [];
    for (const page of (store as any).pages ?? []) {
      for (const child of page.children ?? []) {
        if (child.type === 'text' && typeof child.text === 'string' && child.text.trim()) {
          liveTextRefs.push({
            el: child,
            original: child.text,
            originalAlign: typeof child.align === 'string' ? child.align : 'center',
          });
        }
      }
    }

    let restored = false;
    const restoreOriginals = () => {
      if (restored) return;
      restored = true;
      for (const { el, original, originalAlign } of liveTextRefs) {
        try { el.set({ text: original, align: originalAlign }); } catch { /* ignore */ }
      }
    };

    try {
      const translations = await Promise.all(
        liveTextRefs.map(async ({ original }) => {
          try {
            const res = await fetch('/media/translate-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: original, targetLanguage: langCode }),
            });
            const data = await res.json();
            const translated = (data?.response ?? original).trim();
            return translated || original;
          } catch (err) {
            console.error('[Polonto] translate failed for layer:', err);
            return original;
          }
        })
      );

      liveTextRefs.forEach(({ el }, i) => {
        try { el.set({ text: translations[i] }); } catch (err) {
          console.warn('[Polonto] could not mutate text element:', err);
        }
      });

      if (langCode === 'ar') {
        liveTextRefs.forEach(({ el }) => {
          try { el.set({ align: 'right' }); } catch { /* ignore */ }
        });
      }

      const translatedJson = (store as any).toJSON();

      const blob = await store.toBlob({ pixelRatio: 2 });
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const saveRes = await fetch('/media/save-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polotnoJson: translatedJson,
          thumbnailBase64: dataUrl,
          originalName: `template-${langCode}.png`,
        }),
      });
      const saved = await saveRes.json();

      restoreOriginals();
      close.setMedia([{ id: saved.id, path: saved.path }]);
      close.close();
    } catch (err) {
      console.error('[Polonto] duplicate-for-language failed:', err);
      restoreOriginals();
    } finally {
      setTranslating(null);
      setTranslateOpen(false);
    }
  };

  const saveLabel = close.fullHeight
    ? t('save_product', 'Save Product')
    : t('use_this_media', 'Use this media');

  return (
    <div className="flex items-center gap-[8px]">
      <div className="relative">
        <button
          type="button"
          disabled={translating !== null}
          onClick={() => setTranslateOpen((v) => !v)}
          className="cursor-pointer h-[40px] px-[14px] rounded-[8px] bg-white text-black text-[13px] font-[500] border border-black/10 disabled:opacity-60"
        >
          {translating
            ? `${t('translating', 'Translating')} ${translating.toUpperCase()}…`
            : `${t('duplicate_for_language', 'Duplicate for language')} ▾`}
        </button>
        {translateOpen && translating === null && (
          <div className="absolute right-0 top-[44px] z-[500] bg-white text-black border border-black/10 rounded-[8px] shadow min-w-[180px] overflow-hidden">
            {TRANSLATE_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => duplicateForLanguage(lang.code)}
                className="cursor-pointer w-full text-left px-[14px] py-[8px] text-[13px] hover:bg-black/5 flex justify-between items-center gap-[10px]"
              >
                <span>{lang.label}</span>
                <span className="text-[11px] opacity-60 uppercase">{lang.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button
        loading={load}
        className="outline-none"
        innerClassName="invert outline-none text-black"
        onClick={async () => {
          setLoad(true);
          try {
            const blob = await store.toBlob({ pixelRatio: 2 });
            if (close.initialJson !== undefined) {
              const dataUrl: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              const polotnoJson = (store as any).toJSON();
              const data = await fetch('/media/save-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ polotnoJson, thumbnailBase64: dataUrl, originalName: 'design.png' }),
              }).then((r) => r.json());
              close.setMedia([{ id: data.id, path: data.path }]);
            } else {
              const formData = new FormData();
              formData.append('file', blob, 'media.png');
              const data = await (
                await fetch('/media/upload-simple', { method: 'POST', body: formData })
              ).json();

              if (close.fullHeight) {
                try {
                  const json = store.toJSON();
                  await fetch('/templates', {
                    method: 'POST',
                    body: JSON.stringify({
                      name: 'Design ' + new Date().toLocaleDateString(),
                      json: JSON.stringify(json),
                      preview: data.path,
                      width: store.width,
                      height: store.height,
                    }),
                  });
                } catch {
                  // optional template save for Design Media
                }
              }

              close.setMedia([{ id: data.id, path: data.path }]);
            }
            close.close();
            if (close.fullHeight) {
              toaster.show(t('saved_to_media', 'Saved to Media!'), 'success');
            }
          } catch {
            if (close.fullHeight) {
              toaster.show(t('save_failed', 'Failed to save'), 'warning');
            }
          } finally {
            setLoad(false);
          }
        }}
      >
        {saveLabel}
      </Button>
    </div>
  );
};

const Polonto: FC<{
  setMedia: (params: { id: string; path: string }[]) => void;
  type?: 'image' | 'video';
  closeModal: () => void;
  width?: number;
  height?: number;
  fullHeight?: boolean;
  initialJson?: unknown;
}> = (props) => {
  const { setMedia, closeModal, fullHeight, initialJson } = props;
  const { backendUrl, plontoKey } = useVariables();

  const store = useMemo(
    () => createStore({ key: plontoKey || '', showCredit: false }),
    [plontoKey]
  );

  const setActivateExitButton = useLaunchStore((e) => e.setActivateExitButton);
  useEffect(() => {
    setActivateExitButton(false);
    return () => {
      setActivateExitButton(true);
    };
  }, []);

  useEffect(() => {
    if (backendUrl) {
      setAPI('translateText', () => `${backendUrl}/media/translate-text`);
      setAPI('mediaList', (args?: any) => {
        const { page, query } = args || {};
        const params = new URLSearchParams({ page: String(page || 1) });
        if (query) params.set('search', query);
        return `${backendUrl}/media?${params.toString()}`;
      });
      setAPI('userTemplateList', (args?: any) => {
        const { page, query } = args || {};
        const params = new URLSearchParams({ page: String(page || 1) });
        if (query) params.set('search', query);
        return `${backendUrl}/templates?${params.toString()}`;
      });
    }
  }, [backendUrl]);

  const user = useUser();
  const features = useMemo(() => {
    const sections: any[] = [];

    for (const section of DEFAULT_SECTIONS) {
      if (section.name === 'photos') {
        sections.push({
          ...section,
          name: 'components',
          icon: (props: any) => (
            <div
              className={`text-center text-[11px] font-[600] ${props.isActive ? 'text-white' : 'text-textColor/60'}`}
            >
              Components
            </div>
          ),
        });
        sections.push(BrandAssetsSection);
      } else {
        sections.push(section);
      }
    }

    if (user?.tier?.image_generator) {
      sections.push(PictureGeneratorSection);
    }

    return sections;
  }, [user?.tier?.image_generator]);

  useEffect(() => {
    if (initialJson) {
      try {
        (store as any).loadJSON(initialJson, true);
        requestAnimationFrame(() => fitDecomposedTextLayers(store));
      } catch (err) {
        console.error('[Polonto] failed to load initialJson, falling back to blank page:', err);
        const pageW = props.width || 540;
        const pageH = props.height || 675;
        store.addPage({ width: pageW, height: pageH });
        store.setSize(pageW, pageH);
      }
    } else {
      const pageW = props.width || 540;
      const pageH = props.height || 675;
      store.addPage({ width: pageW, height: pageH });
      store.setSize(pageW, pageH);
    }
    return () => {
      store.clear();
    };
  }, []);

  return (
    <div className={`bg-white text-black relative z-[400] polonto ${fullHeight ? 'h-full' : ''}`}>
      <CloseContext.Provider
        value={{
          close: () => closeModal(),
          setMedia,
          initialJson,
          fullHeight: !!fullHeight,
        }}
      >
        <RaeditorContainer
          style={{
            width: '100%',
            height: fullHeight ? '100%' : '700px',
          }}
        >
          <SidePanelWrap>
            <SidePanel store={store} sections={features} />
          </SidePanelWrap>
          <WorkspaceWrap>
            <Toolbar
              store={store}
              components={{
                ActionControls,
              }}
            />
            <Workspace store={store} />
            <ZoomButtons store={store} />
          </WorkspaceWrap>
        </RaeditorContainer>
      </CloseContext.Provider>
    </div>
  );
};

export default Polonto;
