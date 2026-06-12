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

const inputClass =
  'w-full bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[14px] py-[10px] text-newTextColor text-[14px] placeholder-textItemBlur focus:outline-none focus:border-btnPrimary transition-colors cursor-text';

const selectClass = clsx(inputClass, 'cursor-pointer');

const labelClass =
  'block text-[12px] font-[600] text-textItemBlur mb-[6px] uppercase tracking-wide';

type AuroraMode = 'creative-studio' | 'lifestyle-gen';

const ASPECT_RATIOS = [
  '1:1',
  '3:4',
  '4:3',
  '16:9',
  '9:16',
  '21:9',
] as const;

type AspectRatio = (typeof ASPECT_RATIOS)[number];

const CREATIVE_PERSONAS = [
  'editorial',
  'paradox',
  'nostalgic',
  'minimal',
  'candid',
  'data_hero',
  'split',
] as const;

const REGIONS = [
  'Asia',
  'Africa',
  'Latam',
  'Europe',
  'Middle East',
  'North America',
  'Oceania',
  'South Asia',
  'Southeast Asia',
] as const;

const GENDERS = ['Man', 'Woman', 'Non-binary'] as const;
const SETTINGS = ['Indoor', 'Outdoor'] as const;
const ACTIVITIES = ['None', 'Using Phone', 'Using Computer'] as const;
const CLOTHING = ['Professional', 'Casual', 'Regional Appropriate'] as const;
const TIMES = ['Daytime', 'Golden Hour', 'Evening'] as const;
const IMAGE_MODELS = ['imagen4', 'gemini', 'mix'] as const;
const IMAGE_PROVIDERS = ['google', 'openai'] as const;

const AuroraProviderComponent: FC = () => {
  const thirdParty = useThirdParty();
  const apiFetch = useFetch();

  const [mode, setMode] = useState<AuroraMode>('creative-studio');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([
    'editorial',
    'minimal',
  ]);
  const [onBrand, setOnBrand] = useState(true);
  const [logo, setLogo] = useState(false);
  const [disclaimer, setDisclaimer] = useState(false);
  const [imageProvider, setImageProvider] = useState<'google' | 'openai'>(
    'google'
  );

  const [region, setRegion] = useState<(typeof REGIONS)[number]>('Europe');
  const [gender, setGender] = useState<(typeof GENDERS)[number]>('Woman');
  const [setting, setSetting] = useState<(typeof SETTINGS)[number]>('Indoor');
  const [activity, setActivity] =
    useState<(typeof ACTIVITIES)[number]>('Using Computer');
  const [clothingStyle, setClothingStyle] =
    useState<(typeof CLOTHING)[number]>('Professional');
  const [timeOfDay, setTimeOfDay] = useState<(typeof TIMES)[number]>('Daytime');
  const [city, setCity] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [imageModel, setImageModel] =
    useState<(typeof IMAGE_MODELS)[number]>('imagen4');
  const [lifestyleImageProvider, setLifestyleImageProvider] = useState<
    'google' | 'openai'
  >('google');
  const [guidelinesText, setGuidelinesText] = useState('');
  const [guidelinesFile, setGuidelinesFile] = useState<{
    filename: string;
    data_base64: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromPost = thirdParty.data.map((p) => p.content).join('\n').trim();
    setPrompt(fromPost.slice(0, 5000));
  }, [thirdParty.data]);

  const togglePersona = useCallback((p: string) => {
    setSelectedPersonas((cur) => {
      if (cur.includes(p)) {
        return cur.length > 1 ? cur.filter((x) => x !== p) : cur;
      }
      return [...cur, p];
    });
  }, []);

  const onGuidelinesFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) {
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Guidelines file must be 10MB or smaller.');
        return;
      }
      const allowed = new Set([
        'text/plain',
        'text/markdown',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]);
      if (!allowed.has(file.type) && !/\.(txt|md|pdf|docx)$/i.test(file.name)) {
        setError('Guidelines file must be .txt, .md, .pdf, or .docx');
        return;
      }
      const reader = new FileReader();
      const data_base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const r = reader.result;
          if (typeof r !== 'string' || !r.includes(',')) {
            reject(new Error('Failed to read file'));
            return;
          }
          resolve(r.split(',')[1] || '');
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      setGuidelinesFile({ filename: file.name, data_base64 });
      setError(null);
    },
    []
  );

  const submit = useCallback(async () => {
    if (!prompt.trim()) {
      setError(
        mode === 'creative-studio'
          ? 'Please enter a prompt.'
          : 'Please enter a brief (scene description).'
      );
      return;
    }
    if (!thirdParty?.id || String(thirdParty.id).trim() === '') {
      logThirdPartyClient(
        'aurora_submit_blocked',
        'integration_not_ready',
        {
          plugin: 'aurora',
          context: safeThirdPartyContextSnapshot(thirdParty),
        },
        'warn'
      );
      setError(
        'Integration is not ready. Close this window, open Integrations again, and retry.'
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base: Record<string, unknown> = {
        mode,
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
      };

      if (mode === 'creative-studio') {
        base.image_provider = imageProvider;
        base.personas = selectedPersonas;
        base.on_brand = onBrand;
        base.logo = logo;
        base.disclaimer = disclaimer;
      } else {
        base.lifestyle_image_provider = lifestyleImageProvider;
        base.region = region;
        base.gender = gender;
        base.setting = setting;
        base.activity = activity;
        base.clothing_style = clothingStyle;
        base.time_of_day = timeOfDay;
        base.num_images = numImages;
        base.image_model = imageModel;
        if (city.trim()) {
          base.city = city.trim();
        }
        if (guidelinesText.trim()) {
          base.guidelines_text = guidelinesText.trim();
        }
        if (guidelinesFile) {
          base.guidelines_file = guidelinesFile;
        }
      }

      const res = await apiFetch(`/third-party/${thirdParty.id}/submit`, {
        method: 'POST',
        body: JSON.stringify(base),
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof resBody?.message === 'string' && resBody.message.trim()
            ? resBody.message
            : 'Generation failed. Please try again.';
        setError(msg);
        return;
      }
      if (
        typeof resBody?.path !== 'string' ||
        !resBody.path.trim() ||
        typeof resBody?.id !== 'string'
      ) {
        setError('Invalid response from server (missing media).');
        return;
      }
      thirdParty.onChange(resBody);
      queueMicrotask(() => {
        thirdParty.close();
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : 'Generation failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [
    apiFetch,
    thirdParty,
    mode,
    prompt,
    aspectRatio,
    selectedPersonas,
    onBrand,
    logo,
    disclaimer,
    imageProvider,
    region,
    gender,
    setting,
    activity,
    clothingStyle,
    timeOfDay,
    city,
    numImages,
    imageModel,
    lifestyleImageProvider,
    guidelinesText,
    guidelinesFile,
  ]);

  const modeDescription =
    mode === 'creative-studio'
      ? 'Generates branded campaign-style images. No text is added to the image — add your text as layers in the editor below.'
      : 'Generates realistic lifestyle and people imagery. No text is added — add your text as layers in the editor below.';

  const promptPlaceholder =
    mode === 'creative-studio'
      ? 'e.g. A confident professional looking at financial charts, professional lighting, on-brand colours'
      : 'e.g. Young professional checking trading app in a financial district, natural lighting';

  return (
    <div className="flex flex-col gap-[20px]">
      {loading && (
        <div className="fixed left-0 top-0 w-full leading-[50px] pt-[200px] h-screen bg-black/90 z-50 flex flex-col justify-center items-center text-center text-xl px-[24px]">
          Generating your image with Aurora…
          <br />
          This can take up to a few minutes. Do not close this window.
          <br />
          <LoadingComponent width={200} height={200} />
        </div>
      )}

      <div className="flex flex-col gap-[10px]">
        <label className={labelClass}>Mode</label>
        <div className="flex flex-wrap gap-[8px]">
          {(
            [
              { id: 'creative-studio' as const, label: 'Creative Studio' },
              { id: 'lifestyle-gen' as const, label: 'Lifestyle Gen' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={loading}
              onClick={() => setMode(opt.id)}
              className={clsx(
                'px-[12px] py-[6px] rounded-full border text-[13px] font-[500] transition-all cursor-pointer',
                mode === opt.id
                  ? 'bg-btnPrimary text-white border-btnPrimary'
                  : 'bg-newBgColorInner text-textItemBlur border-newTableBorder hover:border-btnPrimary/60',
                loading && 'opacity-60 cursor-not-allowed'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-textItemBlur leading-relaxed">
          {modeDescription}
        </p>
      </div>

      <div>
        <label className={labelClass}>
          {mode === 'creative-studio' ? 'Prompt' : 'Brief'}
        </label>
        <textarea
          rows={6}
          maxLength={5000}
          className={clsx(inputClass, 'resize-y min-h-[140px]')}
          placeholder={promptPlaceholder}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <p className="text-[12px] text-textItemBlur mt-[4px]">
          {prompt.length} / 5000
        </p>
      </div>

      <div>
        <label className={labelClass}>Aspect Ratio</label>
        <select
          className={selectClass}
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
          disabled={loading}
        >
          {ASPECT_RATIOS.map((ar) => (
            <option key={ar} value={ar}>
              {ar}
            </option>
          ))}
        </select>
      </div>

      {mode === 'creative-studio' ? (
        <>
          <div className="flex flex-col gap-[10px]">
            <label className={labelClass}>Personas</label>
            <p className="text-[12px] text-textItemBlur">
              Optional creative archetypes: editorial, paradox, nostalgic, minimal,
              candid, data_hero, split.
            </p>
            <div className="flex flex-wrap gap-[8px]">
              {CREATIVE_PERSONAS.map((p) => {
                const selected = selectedPersonas.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={loading}
                    onClick={() => togglePersona(p)}
                    className={clsx(
                      'px-[12px] py-[6px] rounded-full border text-[13px] font-[500] transition-all cursor-pointer',
                      selected
                        ? 'bg-btnPrimary text-white border-btnPrimary'
                        : 'bg-newBgColorInner text-textItemBlur border-newTableBorder hover:border-btnPrimary/60',
                      loading && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>Image Provider</label>
            <select
              className={selectClass}
              value={imageProvider}
              onChange={(e) =>
                setImageProvider(e.target.value as 'google' | 'openai')
              }
              disabled={loading}
            >
              {IMAGE_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-[10px]">
            {(
              [
                [
                  'on_brand',
                  onBrand,
                  setOnBrand,
                  'On-Brand Mode',
                  'Brand constraints',
                ] as const,
                [
                  'logo',
                  logo,
                  setLogo,
                  'Logo Space',
                  'Reserve space for logo overlay',
                ] as const,
                [
                  'disclaimer',
                  disclaimer,
                  setDisclaimer,
                  'Disclaimer Space',
                  'Reserve space for regulatory disclaimer',
                ] as const,
              ] as const
            ).map(([key, val, setter, title, sub]) => (
              <div
                key={key}
                className="bg-btnSimple border border-newTableBorder rounded-[12px] px-[14px] py-[12px] flex items-center justify-between"
              >
                <div>
                  <div className="text-[15px] font-[600] text-newTextColor">
                    {title}
                  </div>
                  <div className="text-[12px] text-textItemBlur">{sub}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setter(!val)}
                  className={clsx(
                    'w-[48px] h-[28px] rounded-full p-[3px] transition-colors cursor-pointer',
                    val ? 'bg-btnPrimary' : 'bg-newTableBorder'
                  )}
                  disabled={loading}
                >
                  <span
                    className={clsx(
                      'block w-[22px] h-[22px] bg-white rounded-full transition-transform',
                      val ? 'translate-x-[20px]' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            <div>
              <label className={labelClass}>Region</label>
              <select
                className={selectClass}
                value={region}
                onChange={(e) =>
                  setRegion(e.target.value as (typeof REGIONS)[number])
                }
                disabled={loading}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select
                className={selectClass}
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as (typeof GENDERS)[number])
                }
                disabled={loading}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Setting</label>
              <select
                className={selectClass}
                value={setting}
                onChange={(e) =>
                  setSetting(e.target.value as (typeof SETTINGS)[number])
                }
                disabled={loading}
              >
                {SETTINGS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Activity</label>
              <select
                className={selectClass}
                value={activity}
                onChange={(e) =>
                  setActivity(e.target.value as (typeof ACTIVITIES)[number])
                }
                disabled={loading}
              >
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Clothing Style</label>
              <select
                className={selectClass}
                value={clothingStyle}
                onChange={(e) =>
                  setClothingStyle(e.target.value as (typeof CLOTHING)[number])
                }
                disabled={loading}
              >
                {CLOTHING.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Time of Day</label>
              <select
                className={selectClass}
                value={timeOfDay}
                onChange={(e) =>
                  setTimeOfDay(e.target.value as (typeof TIMES)[number])
                }
                disabled={loading}
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>City (Optional)</label>
            <input
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. London"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
            <div>
              <label className={labelClass}>Num Images</label>
              <select
                className={selectClass}
                value={String(numImages)}
                onChange={(e) => setNumImages(Number(e.target.value))}
                disabled={loading}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Image Model</label>
              <select
                className={selectClass}
                value={imageModel}
                onChange={(e) =>
                  setImageModel(e.target.value as (typeof IMAGE_MODELS)[number])
                }
                disabled={loading}
              >
                {IMAGE_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Image Provider</label>
              <select
                className={selectClass}
                value={lifestyleImageProvider}
                onChange={(e) =>
                  setLifestyleImageProvider(
                    e.target.value as 'google' | 'openai'
                  )
                }
                disabled={loading}
              >
                {IMAGE_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Guidelines Text (Optional)</label>
            <textarea
              rows={3}
              className={clsx(inputClass, 'resize-y min-h-[80px]')}
              value={guidelinesText}
              onChange={(e) => setGuidelinesText(e.target.value)}
              placeholder="Optional brand or compliance notes as plain text"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <label className={labelClass}>Guidelines File</label>
              <span className="text-[12px] text-textItemBlur">
                (Optional, max 10MB)
              </span>
            </div>
            <p className="text-[12px] text-textItemBlur">
              .txt, .md, .pdf, or .docx per Aurora API
            </p>
            <label className="w-full border border-dashed border-newTableBorder rounded-[12px] h-[56px] flex items-center justify-center text-[14px] text-textItemBlur cursor-pointer hover:border-btnPrimary/60 transition-colors">
              {guidelinesFile ? guidelinesFile.filename : 'Click to upload a guidelines file'}
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={onGuidelinesFile}
                disabled={loading}
              />
            </label>
            {guidelinesFile ? (
              <div className="flex items-center justify-between bg-btnSimple border border-newTableBorder rounded-[8px] px-[12px] py-[8px]">
                <span className="text-[12px] text-newTextColor truncate">
                  {guidelinesFile.filename}
                </span>
                <button
                  type="button"
                  className="text-[12px] text-red-400 hover:opacity-80 transition-opacity cursor-pointer shrink-0"
                  onClick={() => setGuidelinesFile(null)}
                  disabled={loading}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className={clsx(
          'w-full h-[44px] rounded-[8px] font-[600] text-[14px] flex items-center justify-center gap-[8px] transition-all cursor-pointer',
          loading
            ? 'bg-btnSimple text-textItemBlur cursor-not-allowed'
            : 'bg-btnPrimary text-white hover:opacity-90 active:scale-[0.99]'
        )}
      >
        {loading ? (
          <>
            <span className="inline-block w-[16px] h-[16px] border-2 border-textItemBlur border-t-white rounded-full animate-spin" />
            Generating… (this can take a few minutes)
          </>
        ) : (
          'Generate Image'
        )}
      </button>

      {error ? <p className="text-red-400 text-[13px]">{error}</p> : null}
    </div>
  );
};

export default thirdPartyWrapper('aurora', AuroraProviderComponent);
