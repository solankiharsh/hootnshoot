'use client';

import { thirdPartyWrapper } from '@gitroom/frontend/components/third-parties/third-party.wrapper';
import { useThirdParty } from '@gitroom/frontend/components/third-parties/third-party.context';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import clsx from 'clsx';
import type { ChangeEvent } from 'react';
import { FC, useCallback, useEffect, useState } from 'react';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  logThirdPartyClient,
  safeThirdPartyContextSnapshot,
} from '@gitroom/frontend/components/third-parties/third-party.client-diagnostics';
import { gener8SubmitAsyncPollAndComplete } from '@gitroom/frontend/components/third-parties/gener8-async.client';

const inputClass =
  'w-full bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[14px] py-[10px] text-newTextColor text-[14px] placeholder-textItemBlur focus:outline-none focus:border-btnPrimary transition-colors cursor-text';

const labelClass =
  'block text-[12px] font-[600] text-textItemBlur mb-[6px] uppercase tracking-wide';

const ASPECT_RATIOS = [
  '4:5',
  '1:1',
  '9:16',
  '16:9',
  '4:3',
  '3:4',
  '2:3',
  '3:2',
] as const;

const RESOLUTION_OPTIONS = ['1K', '2K', '4K'] as const;

type Resolution = (typeof RESOLUTION_OPTIONS)[number];

const Gener8ProviderComponent: FC = () => {
  const thirdParty = useThirdParty();
  const apiFetch = useFetch();

  const [campaignBrief, setCampaignBrief] = useState('');
  const [availablePersonas, setAvailablePersonas] = useState<string[]>([
    'bernbacher',
    'scrollbreaker',
  ]);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([
    'bernbacher',
    'scrollbreaker',
  ]);
  const [aspectRatio, setAspectRatio] = useState<string>('4:5');
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [onBrand, setOnBrand] = useState(true);
  const [addDisclaimer, setAddDisclaimer] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fromPost = thirdParty.data.map((p) => p.content).join('\n').trim();
    setCampaignBrief(fromPost);
  }, [thirdParty.data]);

  useEffect(() => {
    let active = true;
    const loadPersonas = async () => {
      try {
        const res = await apiFetch('/image/personas', { method: 'GET' });
        if (!res.ok) {
          throw new Error('Failed to fetch personas');
        }
        const data = await res.json();
        const rawList = Array.isArray(data)
          ? data
          : Array.isArray(data?.personas)
            ? data.personas
            : [];
        const normalized = rawList
          .map((entry: unknown) =>
            typeof entry === 'string'
              ? entry.trim()
              : entry &&
                  typeof entry === 'object' &&
                  'name' in entry &&
                  typeof (entry as { name: unknown }).name === 'string'
                ? (entry as { name: string }).name.trim()
                : ''
          )
          .filter(Boolean);

        const personas =
          normalized.length > 0 ? normalized : ['bernbacher', 'scrollbreaker'];
        if (!active) {
          return;
        }
        setAvailablePersonas(personas);
        setSelectedPersonas((current) => {
          const filtered = current.filter((p) => personas.includes(p));
          return filtered.length ? filtered : [personas[0]];
        });
      } catch {
        if (!active) {
          return;
        }
        setAvailablePersonas(['bernbacher', 'scrollbreaker']);
        setSelectedPersonas((current) => {
          const filtered = current.filter((p) =>
            ['bernbacher', 'scrollbreaker'].includes(p)
          );
          return filtered.length ? filtered : ['bernbacher', 'scrollbreaker'];
        });
      }
    };
    loadPersonas();
    return () => {
      active = false;
    };
  }, [apiFetch]);

  const togglePersona = useCallback((persona: string) => {
    setSelectedPersonas((current) => {
      if (current.includes(persona)) {
        return current.length > 1
          ? current.filter((item) => item !== persona)
          : current;
      }
      return [...current, persona];
    });
  }, []);

  const fileToBase64 = useCallback(
    (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
            return;
          }
          reject(new Error('Failed to read selected logo file.'));
        };
        reader.onerror = () =>
          reject(new Error('Failed to read selected logo file.'));
        reader.readAsDataURL(file);
      }),
    []
  );

  const onLogoChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const allowedTypes = new Set(['image/png', 'image/jpeg']);
      if (!allowedTypes.has(file.type)) {
        setError('Logo must be a PNG or JPEG image.');
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo must be 5MB or smaller.');
        event.target.value = '';
        return;
      }
      try {
        const encoded = await fileToBase64(file);
        setLogoFile(file);
        setLogoBase64(encoded);
        setError('');
      } catch {
        setError('Failed to process logo file.');
      }
    },
    [fileToBase64]
  );

  const removeLogo = useCallback(() => {
    setLogoFile(null);
    setLogoBase64(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!campaignBrief.trim()) {
      setError('Please add a campaign brief.');
      return;
    }
    if (selectedPersonas.length === 0) {
      setError('Please select at least one persona.');
      return;
    }
    if (!thirdParty?.id || String(thirdParty.id).trim() === '') {
      logThirdPartyClient(
        'gener8_submit_blocked',
        'integration_not_ready',
        {
          plugin: 'gener8',
          context: safeThirdPartyContextSnapshot(thirdParty),
        },
        'warn'
      );
      setError(
        'Integration is not ready. Close this window, open Integrations again, and retry.'
      );
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        inputText: campaignBrief.trim(),
        aspectRatio,
        resolution,
        personas: selectedPersonas,
        onBrand,
        disclaimer: addDisclaimer,
      };
      if (logoBase64) {
        body.logo = logoBase64;
      }

      const resBody = await gener8SubmitAsyncPollAndComplete(
        apiFetch,
        String(thirdParty.id),
        body
      );
      const path =
        typeof resBody?.path === 'string' ? resBody.path.trim() : '';
      const id =
        resBody?.id != null && String(resBody.id).trim() !== ''
          ? String(resBody.id).trim()
          : '';
      if (!path || !id) {
        setError('Invalid response from server (missing media).');
        return;
      }
      thirdParty.onChange({ ...resBody, id, path });
      queueMicrotask(() => {
        thirdParty.close();
      });
    } catch (e: unknown) {
      const raw =
        e instanceof Error && e.message.trim()
          ? e.message.trim()
          : 'Generation failed. Please try again.';
      const isNetwork =
        e instanceof TypeError ||
        /failed to fetch|networkerror|load failed/i.test(raw);
      setError(
        isNetwork
          ? 'Connection was interrupted before the server finished (common if the API restarted during this long request, or if NEXT_PUBLIC_BACKEND_URL is not reachable from your browser). Wait for the dev server to settle, then try again.'
          : raw
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    campaignBrief,
    aspectRatio,
    resolution,
    selectedPersonas,
    onBrand,
    addDisclaimer,
    logoBase64,
    apiFetch,
    thirdParty,
  ]);

  return (
    <div className="flex flex-col gap-[20px]">
      {submitting && (
        <div className="fixed left-0 top-0 w-full leading-[50px] pt-[200px] h-screen bg-black/90 z-50 flex flex-col justify-center items-center text-center text-xl px-[24px]">
          Generating your image with Gener8…
          <br />
          This can take up to 5 minutes. Do not close this window.
          <br />
          <LoadingComponent width={200} height={200} />
        </div>
      )}

      <div>
        <label className={labelClass}>Campaign Brief</label>
        <textarea
          rows={6}
          className={clsx(inputClass, 'resize-y min-h-[140px]')}
          placeholder="Describe what you want to generate..."
          value={campaignBrief}
          onChange={(e) => setCampaignBrief(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
        <div>
          <label className={labelClass}>Aspect Ratio</label>
          <select
            className={clsx(inputClass, 'cursor-pointer')}
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            disabled={submitting}
          >
            {ASPECT_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Resolution</label>
          <select
            className={clsx(inputClass, 'cursor-pointer')}
            value={resolution}
            onChange={(e) =>
              setResolution(e.target.value as Resolution)
            }
            disabled={submitting}
          >
            {RESOLUTION_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-[10px]">
        <label className={labelClass}>Creative Personas</label>
        <div className="flex flex-wrap gap-[8px]">
          {availablePersonas.map((persona) => {
            const selected = selectedPersonas.includes(persona);
            return (
              <button
                key={persona}
                type="button"
                onClick={() => togglePersona(persona)}
                className={clsx(
                  'px-[12px] py-[6px] rounded-full border text-[13px] font-[500] transition-all cursor-pointer',
                  selected
                    ? 'bg-btnPrimary text-white border-btnPrimary'
                    : 'bg-newBgColorInner text-textItemBlur border-newTableBorder hover:border-btnPrimary/60'
                )}
                disabled={submitting}
              >
                {persona}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-[10px]">
        <div className="bg-btnSimple border border-newTableBorder rounded-[12px] px-[14px] py-[12px] flex items-center justify-between">
          <div>
            <div className="text-[15px] font-[600] text-newTextColor">
              On-Brand Mode
            </div>
            <div className="text-[12px] text-textItemBlur">
              Apply brand guidelines
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOnBrand((v) => !v)}
            className={clsx(
              'w-[48px] h-[28px] rounded-full p-[3px] transition-colors cursor-pointer',
              onBrand ? 'bg-btnPrimary' : 'bg-newTableBorder'
            )}
            disabled={submitting}
          >
            <span
              className={clsx(
                'block w-[22px] h-[22px] bg-white rounded-full transition-transform',
                onBrand ? 'translate-x-[20px]' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        <div className="bg-btnSimple border border-newTableBorder rounded-[12px] px-[14px] py-[12px] flex items-center justify-between">
          <div>
            <div className="text-[15px] font-[600] text-newTextColor">
              Add Disclaimer
            </div>
            <div className="text-[12px] text-textItemBlur">
              Add disclaimer text to images
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAddDisclaimer((v) => !v)}
            className={clsx(
              'w-[48px] h-[28px] rounded-full p-[3px] transition-colors cursor-pointer',
              addDisclaimer ? 'bg-btnPrimary' : 'bg-newTableBorder'
            )}
            disabled={submitting}
          >
            <span
              className={clsx(
                'block w-[22px] h-[22px] bg-white rounded-full transition-transform',
                addDisclaimer ? 'translate-x-[20px]' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center gap-[8px]">
          <label className={labelClass}>Custom Logo</label>
          <span className="text-[12px] text-textItemBlur">(Optional)</span>
        </div>
        <p className="text-[12px] text-textItemBlur">
          Upload a custom logo (PNG or JPEG) to use instead of the default
          logo. Max 5MB.
        </p>
        <label className="w-full border border-dashed border-newTableBorder rounded-[12px] h-[56px] flex items-center justify-center text-[14px] text-textItemBlur cursor-pointer hover:border-btnPrimary/60 transition-colors">
          Click to upload a logo image
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={onLogoChange}
            disabled={submitting}
          />
        </label>
        {logoFile && (
          <div className="flex items-center justify-between bg-btnSimple border border-newTableBorder rounded-[8px] px-[12px] py-[8px]">
            <span className="text-[12px] text-newTextColor truncate">
              {logoFile.name}
            </span>
            <button
              type="button"
              onClick={removeLogo}
              className="text-[12px] text-red-400 hover:opacity-80 transition-opacity cursor-pointer"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className={clsx(
          'w-full h-[44px] rounded-[8px] font-[600] text-[14px] flex items-center justify-center gap-[8px] transition-all cursor-pointer',
          submitting
            ? 'bg-btnSimple text-textItemBlur cursor-not-allowed'
            : 'bg-btnPrimary text-white hover:opacity-90 active:scale-[0.99]'
        )}
      >
        {submitting ? (
          <>
            <span className="inline-block w-[16px] h-[16px] border-2 border-textItemBlur border-t-white rounded-full animate-spin" />
            Generating… (this takes up to 5 minutes)
          </>
        ) : (
          'Generate Image'
        )}
      </button>

      {error ? <p className="text-red-400 text-[13px]">{error}</p> : null}
    </div>
  );
};

export default thirdPartyWrapper('gener8', Gener8ProviderComponent);
