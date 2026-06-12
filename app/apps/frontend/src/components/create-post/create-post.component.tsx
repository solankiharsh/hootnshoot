'use client';

import { FC, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { gener8SubmitAsyncPollAndComplete } from '@gitroom/frontend/components/third-parties/gener8-async.client';
import { ArrowLeft, Copy, Check, PenLine } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { CaptionGenerateControl } from '@gitroom/frontend/components/launches/caption-generate.control';
import { DatePicker } from '@gitroom/frontend/components/launches/helpers/date.picker';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { ComplianceGatePanel } from '@gitroom/frontend/components/compliance/compliance-gate.panel';
import { providerIdentifierToContentCopPlatform } from '@gitroom/frontend/components/compliance/content-cop-platform';
import { loadLanguageRouting } from '@gitroom/frontend/components/settings/language-routing.component';
import { useFeatureFlags } from '@gitroom/frontend/components/launches/helpers/use.feature.flags';
import { CompliancePreviewBanner } from '@gitroom/frontend/components/compliance/compliance-preview-banner';

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentType = 'academy' | 'announcement' | 'campaign';
type ActiveTab = 'generate' | 'drafts';

interface Brief {
  topic: string;
  contentType: ContentType;
}

interface CaptionDraft {
  id: string;
  headline: string;
  body: string;
  hashtags: string;
  savedAt: string;
  brief?: Brief;
}

interface CaptionResult {
  headline: string;
  body: string;
  hashtags: string;
}

const DISCLAIMER_MARKER = '\nThe products offered on our website';

// ─── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'hootnshoot_create_post_state';

type Step = 'result' | 'image' | 'schedule' | 'compliance' | 'distribute';

interface PersistedState {
  step: 'result' | 'image' | 'schedule';
  brief?: Brief;
  result?: CaptionResult;
  activeTab: ActiveTab;
}

function loadState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      let step: 'result' | 'image' | 'schedule' = 'result';
      if (parsed.step === 'image') {
        step = 'image';
      } else if (parsed.step === 'schedule') {
        step = 'schedule';
      } else if (parsed.step === 'brief') {
        step = 'result';
      } else if (parsed.step === 'result') {
        step = 'result';
      }
      return {
        step,
        brief: parsed.brief as Brief | undefined,
        result: parsed.result as CaptionResult | undefined,
        activeTab: (parsed.activeTab as ActiveTab) || 'generate',
      };
    }
  } catch {}
  return { step: 'result', activeTab: 'generate' };
}

function stripDisclaimer(body: string): string {
  const idx = body.indexOf(DISCLAIMER_MARKER);
  return idx !== -1 ? body.slice(0, idx).trim() : body.trim();
}

function saveState(state: PersistedState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// ─── Draft helpers ────────────────────────────────────────────────────────────

const DRAFTS_KEY = 'hootnshoot_caption_drafts';

function loadDrafts(): CaptionDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveDraft(draft: Omit<CaptionDraft, 'id' | 'savedAt'>): CaptionDraft {
  const drafts = loadDrafts();
  const newDraft: CaptionDraft = {
    ...draft,
    id: Date.now().toString(),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(DRAFTS_KEY, JSON.stringify([newDraft, ...drafts]));
  return newDraft;
}

function deleteDraft(id: string) {
  const drafts = loadDrafts().filter((d) => d.id !== id);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

// ─── Build full caption string for clipboard ──────────────────────────────────

function buildFullCaption(headline: string, body: string, hashtags: string): string {
  const parts: string[] = [];
  if (headline.trim()) parts.push(headline.trim());
  if (body.trim()) parts.push(body.trim());
  if (hashtags.trim()) parts.push(hashtags.trim());
  return parts.join('\n\n');
}

// ─── Copy to clipboard button ─────────────────────────────────────────────────

const CopyButton: FC<{ getText: () => string }> = ({ getText }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy caption'}
      className={clsx(
        'flex items-center justify-center w-[36px] h-[36px] rounded-[8px] transition-all border cursor-pointer shrink-0',
        copied
          ? 'bg-green-600/20 text-green-400 border-green-600/30'
          : 'bg-btnSimple text-textItemBlur hover:text-newTextColor hover:bg-boxHover border-newTableBorder'
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
};

// ─── Shared styles ────────────────────────────────────────────────────────────

// cursor-text is applied to all text inputs/textareas via inputClass
// cursor-pointer is applied to all clickable buttons
const inputClass =
  'w-full bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[14px] py-[10px] text-newTextColor text-[14px] placeholder-textItemBlur focus:outline-none focus:border-btnPrimary transition-colors cursor-text';

const labelClass =
  'block text-[12px] font-[600] text-textItemBlur mb-[6px] uppercase tracking-wide';

// ─── Auto-expanding textarea ──────────────────────────────────────────────────

const AutoTextarea: FC<{
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  className?: string;
}> = ({ value, onChange, minRows = 4, className }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(inputClass, 'resize-none overflow-hidden', className)}
    />
  );
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const StepIndicatorRaw: FC<{ step: Step; showCompliance?: boolean }> = ({ step, showCompliance = true }) => {
  const isApprove = step === 'schedule' || step === 'compliance';
  const isDistribute = step === 'distribute';
  return (
    <div className="flex items-center gap-[10px]">
      <div
        className={clsx(
          'flex items-center justify-center w-[26px] h-[26px] rounded-full text-[11px] font-[700] transition-colors',
          step === 'result' ? 'bg-btnPrimary text-white' : 'bg-btnSimple text-textItemBlur'
        )}
      >
        1
      </div>
      <span className={clsx('text-[13px] transition-colors', step === 'result' ? 'font-[700] text-newTextColor' : 'font-[400] text-textItemBlur')}>
        Caption
      </span>
      <div className="flex-1 h-[1px] bg-newTableBorder mx-[4px]" />
      <div
        className={clsx(
          'flex items-center justify-center w-[26px] h-[26px] rounded-full text-[11px] font-[700] transition-colors',
          step === 'image' ? 'bg-btnPrimary text-white' : 'bg-btnSimple text-textItemBlur'
        )}
      >
        2
      </div>
      <span className={clsx('text-[13px] transition-colors', step === 'image' ? 'font-[700] text-newTextColor' : 'font-[400] text-textItemBlur')}>
        Image
      </span>
      <div className="flex-1 h-[1px] bg-newTableBorder mx-[4px]" />
      <div
        className={clsx(
          'flex items-center justify-center w-[26px] h-[26px] rounded-full text-[11px] font-[700] transition-colors',
          isApprove ? 'bg-btnPrimary text-white' : 'bg-btnSimple text-textItemBlur'
        )}
      >
        3
      </div>
      <span className={clsx('text-[13px] transition-colors', isApprove ? 'font-[700] text-newTextColor' : 'font-[400] text-textItemBlur')}>
        {showCompliance ? 'Approve' : 'Schedule'}
      </span>
      {showCompliance && (
        <>
          <div className="flex-1 h-[1px] bg-newTableBorder mx-[4px]" />
          <div
            className={clsx(
              'flex items-center justify-center w-[26px] h-[26px] rounded-full text-[11px] font-[700] transition-colors',
              isDistribute ? 'bg-btnPrimary text-white' : 'bg-btnSimple text-textItemBlur'
            )}
          >
            4
          </div>
          <span className={clsx('text-[13px] transition-colors', isDistribute ? 'font-[700] text-newTextColor' : 'font-[400] text-textItemBlur')}>
            Distribute
          </span>
        </>
      )}
    </div>
  );
};

const StepIndicator: FC<{ step: Step }> = ({ step }) => {
  const { complianceEnabled } = useFeatureFlags();
  return <StepIndicatorRaw step={step} showCompliance={complianceEnabled} />;
};

// ─── Caption editor step ───────────────────────────────────────────────────────

const CaptionResultStep: FC<{
  result: CaptionResult;
  brief?: Brief;
  onSaveDraft: () => void;
  onGenerateImage: (headline: string, body: string, hashtags: string) => void;
}> = ({ result, brief, onSaveDraft, onGenerateImage }) => {
  const [headline, setHeadline] = useState(result.headline);
  const [body, setBody] = useState(result.body);
  const [hashtags, setHashtags] = useState(result.hashtags);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setHeadline(result.headline);
    setBody(result.body);
    setHashtags(result.hashtags);
  }, [result]);

  const handleSaveDraft = () => {
    saveDraft({ headline, body, hashtags, brief });
    setSaved(true);
    onSaveDraft();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-[20px] animate-fadeIn">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1">
          <StepIndicator step="result" />
        </div>
      </div>

      {/* Headline */}
      <div>
        <label className={labelClass}>Headline</label>
        <input
          type="text"
          className={inputClass}
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />
      </div>

      {/* Body */}
      <div>
        <label className={labelClass}>Body</label>
        <AutoTextarea value={body} onChange={setBody} minRows={8} />
      </div>

      {/* Hashtags */}
      <div>
        <label className={labelClass}>Hashtags</label>
        <input
          type="text"
          className={inputClass}
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
        />
      </div>

      {/* Compliance preview (flag-gated; hides if disabled or no banned-word config) */}
      <CompliancePreviewBanner
        caption={`${headline}\n${body}\n${hashtags}`}
      />

      {/* Actions */}
      <div className="flex gap-[10px] pt-[4px] flex-wrap items-center">
        <CaptionGenerateControl
          onCaptionReady={(p) => {
            setHeadline(p.headline);
            setBody(p.body);
            setHashtags(p.hashtags);
          }}
        />

        {/* Copy full caption */}
        <CopyButton
          getText={() => buildFullCaption(headline, body, hashtags)}
        />

        {/* Save as Draft */}
        <button
          onClick={handleSaveDraft}
          className={clsx(
            'flex items-center gap-[6px] px-[16px] h-[44px] rounded-[8px] text-[14px] font-[600] transition-all border cursor-pointer',
            saved
              ? 'bg-green-600/20 text-green-400 border-green-600/30'
              : 'bg-btnSimple text-newTextColor hover:bg-boxHover border-newTableBorder'
          )}
        >
          {saved ? '✓ Saved' : 'Save as Draft'}
        </button>

        {/* Next: Image */}
        <button
          onClick={() => onGenerateImage(headline, body, hashtags)}
          className="flex-1 min-w-[140px] h-[44px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[600] hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
        >
          Next: Image →
        </button>
      </div>
    </div>
  );
};

// ─── Step 3: Image Generation ─────────────────────────────────────────────────

const ImageStep: FC<{
  headline: string;
  body: string;
  onBack: () => void;
  onSchedule: (mediaId: string, mediaPath: string) => void;
}> = ({ headline, body, onBack, onSchedule }) => {
  const fetch = useFetch();
  const [campaignBrief, setCampaignBrief] = useState('');
  const [availablePersonas, setAvailablePersonas] = useState<string[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([
    'bernbacher',
    'scrollbreaker',
  ]);
  const [aspectRatio, setAspectRatio] = useState('4:5');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [onBrand, setOnBrand] = useState(true);
  const [addDisclaimer, setAddDisclaimer] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedImageId, setGeneratedImageId] = useState<string | null>(null);
  const [gener8IntegrationId, setGener8IntegrationId] = useState<string | null>(
    null
  );

  useEffect(() => {
    setCampaignBrief(`${headline}\n\n${stripDisclaimer(body)}`.trim());
  }, [headline, body]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/third-party', { method: 'GET' });
        if (!res.ok || !active) {
          return;
        }
        const rows = (await res.json()) as Array<{
          id?: string;
          identifier?: string;
        }>;
        const row = rows.find((r) => r.identifier === 'gener8');
        if (active && row?.id) {
          setGener8IntegrationId(String(row.id));
        }
      } catch {
        if (active) {
          setGener8IntegrationId(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [fetch]);

  useEffect(() => {
    let active = true;
    const loadPersonas = async () => {
      try {
        const res = await fetch('/image/personas', { method: 'GET' });
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
          .map((entry: any) =>
            typeof entry === 'string'
              ? entry.trim()
              : typeof entry?.name === 'string'
              ? entry.name.trim()
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
  }, [fetch]);

  const togglePersona = (persona: string) => {
    setSelectedPersonas((current) => {
      if (current.includes(persona)) {
        return current.length > 1
          ? current.filter((item) => item !== persona)
          : current;
      }
      return [...current, persona];
    });
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to read selected logo file.'));
      };
      reader.onerror = () => reject(new Error('Failed to read selected logo file.'));
      reader.readAsDataURL(file);
    });

  const onLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoBase64(null);
  };

  const handleGenerate = async () => {
    if (!campaignBrief.trim()) {
      setError('Please add a campaign brief.');
      return;
    }
    if (selectedPersonas.length === 0) {
      setError('Please select at least one persona.');
      return;
    }
    if (!gener8IntegrationId) {
      setError(
        'Gener8 is not connected for this organization. Add it under Integrations, then try again.'
      );
      return;
    }

    setError('');
    setLoading(true);
    setGeneratedImage(null);

    try {
      const submitBody = {
        inputText: campaignBrief.trim(),
        aspectRatio,
        resolution,
        personas: selectedPersonas,
        onBrand,
        disclaimer: addDisclaimer,
        ...(logoBase64 ? { logo: logoBase64 } : {}),
      };

      const resBody = await gener8SubmitAsyncPollAndComplete(
        fetch,
        gener8IntegrationId,
        submitBody
      );
      const path =
        typeof resBody?.path === 'string' ? resBody.path.trim() : '';
      const id =
        resBody?.id != null && String(resBody.id).trim() !== ''
          ? String(resBody.id).trim()
          : '';
      if (!path || !id) {
        throw new Error('Invalid response from server (missing media).');
      }
      setGeneratedImage(path);
      setGeneratedImageId(id);
    } catch (err) {
      const raw =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Something went wrong. Please try again.';
      const isNetwork =
        err instanceof TypeError ||
        /failed to fetch|networkerror|load failed/i.test(raw);
      setError(
        isNetwork
          ? 'Connection was interrupted before the server finished. If the image still generated, check the server logs; otherwise try again once the network is stable.'
          : raw
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-[20px] animate-fadeIn">
      <div className="flex items-center gap-[10px]">
        <button
          onClick={onBack}
          title="Back to caption"
          className="flex items-center justify-center w-[28px] h-[28px] rounded-[8px] border border-newTableBorder text-textItemBlur hover:text-newTextColor hover:bg-boxHover transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1">
          <StepIndicator step="image" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Campaign Brief</label>
        <textarea
          rows={6}
          className={clsx(inputClass, 'resize-y min-h-[140px]')}
          placeholder="Describe what you want to generate..."
          value={campaignBrief}
          onChange={(e) => setCampaignBrief(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
        <div>
          <label className={labelClass}>Aspect Ratio</label>
          <select
            className={clsx(inputClass, 'cursor-pointer')}
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            disabled={loading}
          >
            {['4:5', '1:1', '9:16', '16:9', '4:3', '3:4', '2:3', '3:2'].map(
              (ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              )
            )}
          </select>
        </div>
        <div>
          <label className={labelClass}>Resolution</label>
          <select
            className={clsx(inputClass, 'cursor-pointer')}
            value={resolution}
            onChange={(e) =>
              setResolution(e.target.value as '1K' | '2K' | '4K')
            }
            disabled={loading}
          >
            {['1K', '2K', '4K'].map((size) => (
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
            <div className="text-[12px] text-textItemBlur">Apply brand guidelines</div>
          </div>
          <button
            type="button"
            onClick={() => setOnBrand((v) => !v)}
            className={clsx(
              'w-[48px] h-[28px] rounded-full p-[3px] transition-colors cursor-pointer',
              onBrand ? 'bg-btnPrimary' : 'bg-newTableBorder'
            )}
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
            disabled={loading}
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
        onClick={handleGenerate}
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
            Generating... (this takes up to 5 minutes)
          </>
        ) : (
          'Generate Image'
        )}
      </button>

      {error && <p className="text-red-400 text-[13px]">{error}</p>}

      {generatedImage && (
        <div className="flex flex-col gap-[12px]">
          <p className={labelClass}>Generated Image</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={generatedImage}
            alt="Generated campaign visual"
            className="w-full max-w-[380px] rounded-[10px] border border-newTableBorder object-cover aspect-[4/5]"
          />
          <button
            type="button"
            onClick={() => onSchedule(generatedImageId!, generatedImage)}
            className="w-full max-w-[380px] h-[44px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[600] hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
          >
            Next: Schedule →
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Step 3: Schedule for Approval ───────────────────────────────────────────

const ScheduleStep: FC<{
  caption: string;
  mediaId: string;
  mediaPath: string;
  onBack: () => void;
  onScheduled: (groupId: string, platform: string, date: dayjs.Dayjs) => void;
}> = ({ caption, mediaId, mediaPath, onBack, onScheduled }) => {
  const fetch = useFetch();
  const { data: integrations = [] } = useIntegrationList();
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(
    () => newDayjs().add(1, 'hour').startOf('hour')
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      setError('Select at least one account.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const group = makeId(10);
      const payload = {
        type: 'schedule',
        publishWhenApproved: true,
        tags: [] as string[],
        shortLink: false,
        date: selectedDate.utc().format('YYYY-MM-DDTHH:mm:ss'),
        posts: Array.from(selectedIds).map((integrationId) => {
          const integration = integrations.find((i: any) => i.id === integrationId);
          const settings: Record<string, unknown> =
            (integration?.identifier as string | undefined)?.startsWith('instagram')
              ? { post_type: 'post' }
              : {};
          return {
            integration: { id: integrationId },
            group,
            settings,
            value: [
              {
                content: caption,
                delay: 0,
                image: mediaId ? [{ id: mediaId, path: mediaPath }] : [],
              },
            ],
          };
        }),
      };
      const res = await fetch('/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        setError(msg || `HTTP ${res.status}`);
        return;
      }
      const resData: Array<{ group?: string }> = await res.json().catch((): Array<{ group?: string }> => []);
      const realGroup: string = resData?.[0]?.group || group;
      const firstIntegration = integrations.find((i: any) => i.id === Array.from(selectedIds)[0]);
      const platform =
        providerIdentifierToContentCopPlatform(firstIntegration?.identifier || '') ?? 'Instagram';
      onScheduled(realGroup, platform, selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-[20px] animate-fadeIn">
      <div className="flex items-center gap-[10px]">
        <button
          onClick={onBack}
          title="Back to image"
          className="flex items-center justify-center w-[28px] h-[28px] rounded-[8px] border border-newTableBorder text-textItemBlur hover:text-newTextColor hover:bg-boxHover transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1">
          <StepIndicator step="schedule" />
        </div>

      </div>

      {/* Caption preview */}
      <div>
        <label className={labelClass}>Caption Preview</label>
        <div className="w-full bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[14px] py-[10px] text-newTextColor text-[13px] whitespace-pre-wrap leading-[1.6] max-h-[140px] overflow-y-auto">
          {caption || '(no caption)'}
        </div>
      </div>

      {/* Image thumbnail */}
      {mediaPath && (
        <div>
          <label className={labelClass}>Image</label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaPath}
            alt="Campaign visual"
            className="w-[120px] h-[120px] rounded-[8px] border border-newTableBorder object-cover"
          />
        </div>
      )}

      {/* Date picker */}
      <div>
        <label className={labelClass}>Schedule Date</label>
        <div className="mt-[6px]">
          <DatePicker date={selectedDate} onChange={setSelectedDate} />
        </div>
      </div>

      {/* Account selection */}
      <div>
        <label className={labelClass}>Publish to Accounts</label>
        {integrations.length === 0 ? (
          <p className="text-[13px] text-textItemBlur mt-[6px]">
            No connected accounts found.
          </p>
        ) : (
          <div className="flex flex-col gap-[8px] mt-[6px]">
            {integrations.map((integration: any) => (
              <label
                key={integration.id}
                className="flex items-center gap-[10px] cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(integration.id)}
                  onChange={() => toggleAccount(integration.id)}
                  className="w-[16px] h-[16px] accent-btnPrimary cursor-pointer"
                />
                <span className="text-[14px] text-newTextColor group-hover:text-btnPrimary transition-colors">
                  {integration.name || integration.identifier}
                </span>
                {integration.picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={integration.picture}
                    alt=""
                    className="w-[20px] h-[20px] rounded-full"
                  />
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-[13px]">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
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
            Scheduling…
          </>
        ) : (
          'Schedule & Submit for Approval'
        )}
      </button>
    </div>
  );
};

// ─── Step 4a: Compliance waiting ─────────────────────────────────────────────

const ComplianceWaitStep: FC<{
  postGroupId: string;
  platform: string;
  onApproved: () => void;
  onSkip: () => void;
  onBack: () => void;
}> = ({ postGroupId, platform, onApproved, onSkip, onBack }) => {
  const fetch = useFetch();
  const [initialJob, setInitialJob] = useState<import('@gitroom/frontend/components/compliance/compliance-gate.panel').ComplianceJobDto | null>(null);
  const [jobLoaded, setJobLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/posts/group/${postGroupId}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active && data?.complianceJob?.id) {
          setInitialJob(data.complianceJob);
        }
      } catch {
        // proceed without initial job
      } finally {
        if (active) setJobLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [postGroupId]);

  return (
    <div className="flex flex-col gap-[20px] animate-fadeIn">
      <div className="flex items-center gap-[10px]">
        <button
          onClick={onBack}
          title="Back to schedule"
          className="flex items-center justify-center w-[28px] h-[28px] rounded-[8px] border border-newTableBorder text-textItemBlur hover:text-newTextColor hover:bg-boxHover transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1">
          <StepIndicator step="compliance" />
        </div>
      </div>

      {!jobLoaded ? (
        <div className="flex items-center gap-[10px] text-[14px] text-textItemBlur py-[20px]">
          <div className="h-[18px] w-[18px] rounded-full border-2 border-btnPrimary border-t-transparent animate-spin shrink-0" />
          Preparing compliance check…
        </div>
      ) : (
        <ComplianceGatePanel
          postGroupId={postGroupId}
          platform={platform}
          onApproved={onApproved}
          onClose={onSkip}
          onFix={onBack}
          initialJob={initialJob}
          autoSubmit={true}
        />
      )}

      <button
        type="button"
        onClick={onSkip}
        className="self-start text-[13px] text-textItemBlur hover:text-newTextColor underline cursor-pointer transition-colors"
      >
        Skip → View in calendar
      </button>
    </div>
  );
};

// ─── Step 4b: Distribute to languages ────────────────────────────────────────

const DIST_LANGUAGES = [
  { code: 'es' as const, label: 'Spanish (ES)' },
  { code: 'pt' as const, label: 'Portuguese (PT)' },
  { code: 'ar' as const, label: 'Arabic (AR)' },
  { code: 'fr' as const, label: 'French (FR)' },
];

type DistLangCode = 'es' | 'pt' | 'ar' | 'fr';
type DistVariantStatus = 'idle' | 'running' | 'done' | 'error';

interface DistVariantState {
  accountId: string;
  date: dayjs.Dayjs;
  checked: boolean;
  status: DistVariantStatus;
  error?: string;
}

const DistributeStep: FC<{
  caption: string;
  mediaId: string;
  mediaPath: string;
  defaultDate: dayjs.Dayjs;
  onDone: () => void;
  onBack: () => void;
}> = ({ caption, mediaId, mediaPath, defaultDate, onDone, onBack }) => {
  const fetch = useFetch();
  const { data: integrations = [] } = useIntegrationList();
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [hasLayers, setHasLayers] = useState(false);

  const [variants, setVariants] = useState<Record<DistLangCode, DistVariantState>>(() => {
    const routing = loadLanguageRouting();
    const initial: Record<DistLangCode, DistVariantState> = {} as Record<DistLangCode, DistVariantState>;
    for (const { code } of DIST_LANGUAGES) {
      initial[code] = {
        accountId: (routing as Record<string, string>)[code] || '',
        date: defaultDate,
        checked: false,
        status: 'idle',
      };
    }
    return initial;
  });

  useEffect(() => {
    if (!mediaId) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/media/${mediaId}/polotno-json`);
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active && data?.decomposeStatus === 'ready') setHasLayers(true);
      } catch {
        /* ignore */
      }
    })();
    return () => { active = false; };
  }, [mediaId, fetch]);

  const updateVariant = (code: DistLangCode, patch: Partial<DistVariantState>) => {
    setVariants((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  };

  const handleSubmit = async () => {
    const checked = (Object.keys(variants) as DistLangCode[]).filter((c) => variants[c].checked);
    if (checked.length === 0) {
      setGlobalError('Select at least one language.');
      return;
    }
    const missing = checked.filter((c) => !variants[c].accountId);
    if (missing.length > 0) {
      setGlobalError(`Select an account for: ${missing.map((c) => c.toUpperCase()).join(', ')}`);
      return;
    }
    setGlobalError('');
    setSubmitting(true);
    checked.forEach((c) => updateVariant(c, { status: 'running' }));

    await Promise.all(
      checked.map(async (code) => {
        const { accountId, date } = variants[code];
        try {
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
          const integration = (integrations as any[]).find((i) => i.id === accountId);
          const settings: Record<string, unknown> =
            (integration?.identifier as string | undefined)?.startsWith('instagram')
              ? { post_type: 'post' }
              : {};
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
                settings,
                value: [
                  {
                    content: translatedCaption,
                    delay: 0,
                    image: mediaId ? [{ id: mediaId, path: mediaPath }] : [],
                  },
                ],
              },
            ],
          };
          const res = await fetch('/posts', { method: 'POST', body: JSON.stringify(payload) });
          if (!res.ok) {
            const msg = await res.text().catch(() => `HTTP ${res.status}`);
            throw new Error(msg || `HTTP ${res.status}`);
          }
          updateVariant(code, { status: 'done' });
        } catch (err) {
          updateVariant(code, { status: 'error', error: err instanceof Error ? err.message : 'Failed' });
        }
      })
    );

    setSubmitting(false);
    setTimeout(onDone, 800);
  };

  const checkedCount = (Object.keys(variants) as DistLangCode[]).filter((c) => variants[c].checked).length;

  return (
    <div className="flex flex-col gap-[20px] animate-fadeIn">
      <div className="flex items-center gap-[10px]">
        <button
          onClick={onBack}
          title="Back"
          className="flex items-center justify-center w-[28px] h-[28px] rounded-[8px] border border-newTableBorder text-textItemBlur hover:text-newTextColor hover:bg-boxHover transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1">
          <StepIndicator step="distribute" />
        </div>
      </div>

      <div>
        <p className="text-[14px] text-textItemBlur">
          English post approved. Select languages to schedule translated versions.
        </p>
        {hasLayers && (
          <p className="mt-[8px] text-[12px] text-btnPrimary/80 bg-btnPrimary/8 rounded-[6px] px-[10px] py-[6px]">
            ✨ This image has extractable text layers — open it in the Media editor after scheduling to localise the image per language.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-[12px]">
        {DIST_LANGUAGES.map(({ code, label }) => {
          const variant = variants[code];
          return (
            <div
              key={code}
              className={clsx(
                'border rounded-[8px] p-[14px] flex flex-col gap-[12px] transition-colors',
                variant.checked ? 'border-btnPrimary/40 bg-btnPrimary/5' : 'border-newTableBorder'
              )}
            >
              <div className="flex items-center gap-[10px]">
                <input
                  type="checkbox"
                  id={`dist-lang-${code}`}
                  checked={variant.checked}
                  disabled={submitting}
                  onChange={(e) => updateVariant(code, { checked: e.target.checked })}
                  className="w-[16px] h-[16px] accent-btnPrimary cursor-pointer"
                />
                <label htmlFor={`dist-lang-${code}`} className="text-[14px] font-[600] text-newTextColor cursor-pointer flex-1">
                  {label}
                </label>
                {variant.status === 'running' && (
                  <span className="inline-block w-[14px] h-[14px] border-2 border-textItemBlur border-t-btnPrimary rounded-full animate-spin" />
                )}
                {variant.status === 'done' && <span className="text-green-400 text-[12px] font-[600]">✓ Done</span>}
                {variant.status === 'error' && <span className="text-red-400 text-[12px]">✗ {variant.error}</span>}
              </div>

              {variant.checked && (
                <div className="flex flex-col gap-[10px] pl-[26px]">
                  <div>
                    <div className={labelClass}>Account</div>
                    <select
                      value={variant.accountId}
                      disabled={submitting}
                      onChange={(e) => updateVariant(code, { accountId: e.target.value })}
                      className="w-full bg-newBgColorInner border border-newTableBorder rounded-[6px] px-[10px] py-[7px] text-[13px] text-newTextColor outline-none"
                    >
                      <option value="">— Select account —</option>
                      {(integrations as any[]).map((i) => (
                        <option key={i.id} value={i.id}>{i.name || i.identifier}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={labelClass}>Schedule Date</div>
                    <DatePicker date={variant.date} onChange={(d) => updateVariant(code, { date: d })} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {globalError && <p className="text-red-400 text-[13px]">{globalError}</p>}

      <div className="flex gap-[10px] items-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || checkedCount === 0}
          className={clsx(
            'h-[44px] px-[20px] rounded-[8px] text-[14px] font-[600] transition-all cursor-pointer',
            submitting || checkedCount === 0
              ? 'bg-btnSimple text-textItemBlur cursor-not-allowed opacity-60'
              : 'bg-btnPrimary text-white hover:opacity-90'
          )}
        >
          {submitting ? 'Scheduling…' : `Schedule ${checkedCount > 0 ? `${checkedCount} language${checkedCount > 1 ? 's' : ''}` : 'languages'}`}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-[13px] text-textItemBlur hover:text-newTextColor underline cursor-pointer transition-colors"
        >
          Skip → View in calendar
        </button>
      </div>
    </div>
  );
};

// ─── Drafts Tab ───────────────────────────────────────────────────────────────

const DraftsTab: FC<{
  refreshKey: number;
  onEditDraft: (draft: CaptionDraft) => void;
}> = ({ refreshKey, onEditDraft }) => {
  const [drafts, setDrafts] = useState<CaptionDraft[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(loadDrafts());
  }, [refreshKey]);

  const handleDelete = (id: string) => {
    deleteDraft(id);
    setDrafts(loadDrafts());
  };

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-[48px] gap-[12px] text-textItemBlur">
        <PenLine size={32} strokeWidth={1.5} />
        <p className="text-[14px]">No drafts yet. Generate or write a caption and save it.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[12px]">
      {drafts.map((draft) => (
        <div key={draft.id} className="border border-newTableBorder rounded-[10px] overflow-hidden">
          {/* Header row */}
          <div
            className="flex items-center justify-between px-[16px] py-[12px] cursor-pointer hover:bg-boxHover transition-colors"
            onClick={() => setExpanded(expanded === draft.id ? null : draft.id)}
          >
            <div className="flex flex-col gap-[2px] flex-1 min-w-0">
              <span className="text-[14px] font-[600] text-newTextColor truncate">
                {draft.headline || '(No headline)'}
              </span>
              <span className="text-[11px] text-textItemBlur">
                {new Date(draft.savedAt).toLocaleString()}
                {draft.brief && ` · ${draft.brief.contentType}`}
              </span>
            </div>
            <div className="flex items-center gap-[8px] ml-[12px]">
              {/* Copy full caption from draft list */}
              <CopyButton
                getText={() => buildFullCaption(draft.headline, draft.body, draft.hashtags)}
              />
              <button
                onClick={(e) => { e.stopPropagation(); onEditDraft(draft); }}
                className="text-[12px] text-btnPrimary hover:opacity-80 transition-opacity px-[8px] py-[4px] rounded-[6px] hover:bg-btnPrimary/10 font-[600] cursor-pointer"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(draft.id); }}
                className="text-[12px] text-textItemBlur hover:text-red-400 transition-colors px-[8px] py-[4px] rounded-[6px] hover:bg-red-400/10 cursor-pointer"
              >
                Delete
              </button>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none"
                className={clsx('text-textItemBlur transition-transform', expanded === draft.id && 'rotate-180')}>
                <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Expanded preview */}
          {expanded === draft.id && (
            <div className="border-t border-newTableBorder px-[16px] py-[16px] flex flex-col gap-[12px] bg-newBgColor">
              {draft.body && (
                <div>
                  <p className={labelClass}>Body</p>
                  <p className="text-[13px] text-newTextColor whitespace-pre-wrap leading-[1.6]">{draft.body}</p>
                </div>
              )}
              {draft.hashtags && (
                <div>
                  <p className={labelClass}>Hashtags</p>
                  <p className="text-[13px] text-textItemBlur">{draft.hashtags}</p>
                </div>
              )}
              <div className="flex gap-[8px]">
                <button
                  onClick={() => onEditDraft(draft)}
                  className="flex items-center gap-[6px] px-[14px] h-[36px] rounded-[8px] bg-btnPrimary text-white text-[13px] font-[600] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <PenLine size={13} />
                  Open in editor
                </button>
                {/* Copy from expanded view */}
                <CopyButton
                  getText={() => buildFullCaption(draft.headline, draft.body, draft.hashtags)}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'generate', label: 'Generate' },
  { id: 'drafts', label: 'Drafts' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const CreatePostComponent: FC = () => {
  const router = useRouter();
  const { complianceEnabled } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => loadState().activeTab);
  const [step, setStep] = useState<Step>(() => {
    const s = loadState();
    return s.step === 'image' ? 'image' : s.step === 'schedule' ? 'schedule' : 'result';
  });
  const [brief, setBrief] = useState<Brief | undefined>(() => loadState().brief);
  const [result, setResult] = useState<CaptionResult>(() => {
    const s = loadState();
    return s.result ?? { headline: '', body: '', hashtags: '' };
  });
  const [draftsRefreshKey, setDraftsRefreshKey] = useState(0);
  const [imageHeadline, setImageHeadline] = useState('');
  const [imageBody, setImageBody] = useState('');
  const [imageHashtags, setImageHashtags] = useState('');
  const [imageMediaId, setImageMediaId] = useState('');
  const [imageMediaPath, setImageMediaPath] = useState('');
  const [postGroupId, setPostGroupId] = useState('');
  const [primaryPlatform, setPrimaryPlatform] = useState('Instagram');
  const [scheduledDate, setScheduledDate] = useState<dayjs.Dayjs>(
    () => newDayjs().add(1, 'hour').startOf('hour')
  );

  // Only persist steps that can be safely restored from session storage
  const persistableStep = (step === 'compliance' || step === 'distribute') ? 'schedule' : step;
  useEffect(() => {
    saveState({ step: persistableStep as 'result' | 'image' | 'schedule', brief, result, activeTab });
  }, [persistableStep, brief, result, activeTab]);

  const handleSaveDraft = () => setDraftsRefreshKey((k) => k + 1);

  const handleEditDraft = (draft: CaptionDraft) => {
    setResult({ headline: draft.headline, body: draft.body, hashtags: draft.hashtags });
    setBrief(draft.brief);
    setStep('result');
    setActiveTab('generate');
  };

  const handleGenerateImage = (headline: string, body: string, hashtags: string) => {
    setImageHeadline(headline);
    setImageBody(body);
    setImageHashtags(hashtags);
    setStep('image');
  };

  const handleSchedule = (mediaId: string, mediaPath: string) => {
    setImageMediaId(mediaId);
    setImageMediaPath(mediaPath);
    setStep('schedule');
  };

  const handleScheduled = (groupId: string, platform: string, date: dayjs.Dayjs) => {
    setPostGroupId(groupId);
    setPrimaryPlatform(platform);
    setScheduledDate(date);
    if (!complianceEnabled) {
      router.push('/launches');
      return;
    }
    setStep('compliance');
  };

  const fullCaption = buildFullCaption(imageHeadline, imageBody, imageHashtags);

  return (
    <div className="flex flex-1 flex-col p-[24px] overflow-y-auto">
      <div className="max-w-[680px] w-full mx-auto flex flex-col gap-[20px]">

        <div>
          <h1 className="text-[24px] font-[600] text-newTextColor">Create Post</h1>
          <p className="text-[14px] text-textItemBlur mt-[4px]">
            Generate or write a partner-ready caption for your audience.
          </p>
        </div>

        {/* Tab bar — hidden on compliance/distribute steps to keep focus */}
        {step !== 'compliance' && step !== 'distribute' && (
          <div className="flex gap-[4px] border-b border-newTableBorder">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'px-[16px] py-[10px] text-[14px] font-[600] transition-colors border-b-2 -mb-[1px] cursor-pointer',
                  activeTab === tab.id
                    ? 'border-btnPrimary text-newTextColor'
                    : 'border-transparent text-textItemBlur hover:text-newTextColor'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Card */}
        <div className="bg-newBgColorInner rounded-[12px] p-[28px]">
          {step === 'compliance' ? (
            <ComplianceWaitStep
              postGroupId={postGroupId}
              platform={primaryPlatform}
              onApproved={() => setStep('distribute')}
              onSkip={() => router.push('/launches')}
              onBack={() => setStep('schedule')}
            />
          ) : step === 'distribute' ? (
            <DistributeStep
              caption={fullCaption}
              mediaId={imageMediaId}
              mediaPath={imageMediaPath}
              defaultDate={scheduledDate}
              onDone={() => router.push('/launches')}
              onBack={() => setStep('compliance')}
            />
          ) : activeTab === 'generate' ? (
            step === 'result' ? (
              <CaptionResultStep
                result={result}
                brief={brief}
                onSaveDraft={handleSaveDraft}
                onGenerateImage={handleGenerateImage}
              />
            ) : step === 'image' ? (
              <ImageStep
                headline={imageHeadline}
                body={imageBody}
                onBack={() => setStep('result')}
                onSchedule={handleSchedule}
              />
            ) : (
              <ScheduleStep
                caption={fullCaption}
                mediaId={imageMediaId}
                mediaPath={imageMediaPath}
                onBack={() => setStep('image')}
                onScheduled={handleScheduled}
              />
            )
          ) : (
            <DraftsTab refreshKey={draftsRefreshKey} onEditDraft={handleEditDraft} />
          )}
        </div>

      </div>
    </div>
  );
};
