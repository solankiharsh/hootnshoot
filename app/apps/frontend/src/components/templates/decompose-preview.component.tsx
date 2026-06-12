'use client';

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createStore } from 'openpolotno/model/store';
import Workspace from 'openpolotno/canvas/workspace';
import { RaeditorContainer, SidePanelWrap, WorkspaceWrap } from 'openpolotno';
import { SidePanel, DEFAULT_SECTIONS } from 'openpolotno/side-panel';
import Toolbar from 'openpolotno/toolbar/toolbar';
import ZoomButtons from 'openpolotno/toolbar/zoom-buttons';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { setAPI } from 'openpolotno/utils/api';
import { useVariables } from '@gitroom/react/helpers/variable.context';

const store = createStore({ showCredit: false });

type OcrStrategy = 'gemini-vision';
type SubjectDetectStrategy = 'gemini-vision' | 'gemini-then-dino' | 'skip';
type SubjectIsolateStrategy = '851-labs' | 'sam2-prompted' | 'skip';
type BgRecoverStrategy = 'nano-banana-text-only' | 'keep-source';

interface Strategies {
  ocr: OcrStrategy;
  subjectDetect: SubjectDetectStrategy;
  subjectIsolate: SubjectIsolateStrategy;
  bgRecover: BgRecoverStrategy;
  autoRefine: boolean;
  numBackgroundCandidates: number;
}

const DEFAULT_STRATEGIES: Strategies = {
  ocr: 'gemini-vision',
  subjectDetect: 'gemini-vision',
  subjectIsolate: '851-labs',
  bgRecover: 'nano-banana-text-only',
  autoRefine: true,
  numBackgroundCandidates: 1,
};

interface QualityIssue {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  layer?: string;
  message: string;
  suggestion?: string;
  apply?: Partial<Strategies>;
}
interface BackgroundCandidateInfo {
  candidatesGenerated: number;
  selectedIndex: number;
  scores: Array<{
    candidateIndex: number;
    score: number;
    colorScore: number;
    seamScore: number;
    thumbnail: string;
  }>;
}
interface QualityReport {
  score: number;
  issues: QualityIssue[];
  tierBRan: boolean;
  refined?: { ocrAdded: number; subjectsAdded: number };
  backgroundCandidates?: BackgroundCandidateInfo;
}

export const DecomposePreview: FC = () => {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [strategies, setStrategies] = useState<Strategies>(DEFAULT_STRATEGIES);
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<{
    layers: number;
    types: string[];
  } | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);

  // Wire the Photos panel to the backend media endpoint so it loads instead
  // of spinning forever on an unconfigured polotno API key.
  useEffect(() => {
    if (backendUrl) {
      setAPI('mediaList', (args?: any) => {
        const { page, query } = args || {};
        const params = new URLSearchParams({ page: String(page || 1) });
        if (query) params.set('search', query);
        return `${backendUrl}/media?${params.toString()}`;
      });
    }
  }, [backendUrl]);

  useEffect(() => {
    if (store.pages.length === 0) {
      store.addPage({ width: 1080, height: 1350 });
    }
    return () => {
      store.clear();
    };
  }, []);

  const runDecompose = useCallback(
    async (file: File, strats: Strategies) => {
      setError(null);
      setStats(null);
      setElapsedMs(null);

      const imageBase64 = await fileToBase64(file);
      const imageMimeType = file.type || 'image/png';

      setLoading(true);
      const start = Date.now();
      try {
        const response = await fetch('/templates/decompose', {
          method: 'POST',
          body: JSON.stringify({
            imageBase64,
            imageMimeType,
            strategies: strats,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '(unreadable)');
          throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = (await response.json()) as {
          template: unknown;
          quality?: QualityReport;
        };
        const elapsed = Date.now() - start;

        store.clear();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (store as any).loadJSON(data.template, true);
        const { fitDecomposedTextLayers } = await import(
          '@gitroom/frontend/components/launches/polonto/fit-decomposed-text'
        );
        requestAnimationFrame(() => fitDecomposedTextLayers(store));

        const tmpl = data.template as {
          pages: { children: { type: string; name?: string }[] }[];
        };
        const children = tmpl.pages?.[0]?.children ?? [];
        setStats({
          layers: children.length,
          types: children.map((c) => `${c.type}:${c.name ?? '?'}`),
        });
        setElapsedMs(elapsed);
        setQuality(data.quality ?? null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [fetch]
  );

  const onFile = useCallback(
    async (file: File) => {
      setLastFile(file);
      const blobUrl = URL.createObjectURL(file);
      setOriginalUrl(blobUrl);
      await runDecompose(file, strategies);
    },
    [runDecompose, strategies]
  );

  const onRegenerate = useCallback(() => {
    if (!lastFile) return;
    runDecompose(lastFile, strategies);
  }, [lastFile, runDecompose, strategies]);

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) =>
        i.type.startsWith('image/')
      );
      if (item) {
        const file = item.getAsFile();
        if (file) onFile(file);
      }
    },
    [onFile]
  );

  const onExport = useCallback(async () => {
    if (!stats) return;
    setExporting(true);
    try {
      const blob = await store.toBlob({ pixelRatio: 2 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'decomposed-template.png';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [stats]);

  const features = useMemo(() => DEFAULT_SECTIONS as unknown[], []);

  return (
    // flex-1 expands to fill the layout's row flex container (fixes black void
    // on the right). overflow-y-auto lets the page scroll if content overflows.
    <div
      className="flex-1 flex flex-col gap-4 p-6 bg-white text-black overflow-y-auto"
      onPaste={onPaste}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Magic Design — Decompose Preview</h1>
        <div className="text-sm text-gray-500">
          Upload an image → it becomes editable layers in openpolotno
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <Button
          loading={loading}
          onClick={() => fileInputRef.current?.click()}
          innerClassName="invert"
        >
          Upload image
        </Button>
        <Button
          loading={exporting}
          disabled={!stats}
          onClick={onExport}
          innerClassName="invert"
        >
          Export PNG
        </Button>
        <span className="text-sm text-gray-500">
          or paste from clipboard (Cmd+V anywhere on this page)
        </span>
        {loading && (
          <span className="text-sm text-amber-600 animate-pulse">
            Decomposing… 15–45s
          </span>
        )}
        {elapsedMs !== null && (
          <span className="text-sm text-green-700">
            done in {(elapsedMs / 1000).toFixed(1)}s · {stats?.layers ?? 0} layers
          </span>
        )}
      </div>

      <details className="border border-gray-200 rounded p-3 text-sm bg-gray-50" open>
        <summary className="cursor-pointer font-medium select-none">
          Strategies — refine the decomposition
        </summary>
        <div className="grid grid-cols-4 gap-3 mt-3">
          <StrategyDropdown
            label="OCR (text)"
            value={strategies.ocr}
            options={[{ value: 'gemini-vision', label: 'Gemini vision' }]}
            onChange={(v) =>
              setStrategies((s) => ({ ...s, ocr: v as OcrStrategy }))
            }
          />
          <StrategyDropdown
            label="Subject detection"
            value={strategies.subjectDetect}
            options={[
              { value: 'gemini-vision', label: 'Gemini vision' },
              { value: 'gemini-then-dino', label: 'Gemini + grounding-dino (tight bboxes)' },
              { value: 'skip', label: 'Skip' },
            ]}
            onChange={(v) =>
              setStrategies((s) => ({
                ...s,
                subjectDetect: v as SubjectDetectStrategy,
              }))
            }
          />
          <StrategyDropdown
            label="Subject cutout"
            value={strategies.subjectIsolate}
            options={[
              { value: '851-labs', label: '851-labs bg-remover' },
              { value: 'sam2-prompted', label: 'SAM2-prompted (label-aware)' },
              { value: 'skip', label: 'Skip' },
            ]}
            onChange={(v) =>
              setStrategies((s) => ({
                ...s,
                subjectIsolate: v as SubjectIsolateStrategy,
              }))
            }
          />
          <StrategyDropdown
            label="Background"
            value={strategies.bgRecover}
            options={[
              { value: 'nano-banana-text-only', label: 'Nano Banana (text only)' },
              { value: 'keep-source', label: 'Keep source image' },
            ]}
            onChange={(v) =>
              setStrategies((s) => ({
                ...s,
                bgRecover: v as BgRecoverStrategy,
              }))
            }
          />
        </div>
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          <Button
            loading={loading}
            onClick={onRegenerate}
            innerClassName="invert"
            disabled={!lastFile}
          >
            Regenerate with these strategies
          </Button>
          <label className="text-xs text-gray-700 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={strategies.autoRefine}
              onChange={(e) =>
                setStrategies((s) => ({ ...s, autoRefine: e.target.checked }))
              }
            />
            Auto-refine (re-run OCR / subject-detect to recover items the VLM scorecard flagged)
          </label>
          <label className="text-xs text-gray-700 flex items-center gap-2 cursor-pointer">
            BG candidates:
            <select
              className="border border-gray-300 rounded px-1 py-0.5 text-xs bg-white"
              value={strategies.numBackgroundCandidates}
              onChange={(e) =>
                setStrategies((s) => ({
                  ...s,
                  numBackgroundCandidates: Number(e.target.value),
                }))
              }
            >
              <option value={1}>1 (fast)</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4 (best quality)</option>
            </select>
            <span className="opacity-60">scored, best auto-selected</span>
          </label>
          {!lastFile && (
            <span className="text-xs text-gray-500">
              Disabled until you've uploaded an image once
            </span>
          )}
        </div>
      </details>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}

      {quality && (
        <QualityReportPanel
          report={quality}
          onApply={(patch) => {
            const merged: Strategies = { ...strategies, ...patch };
            setStrategies(merged);
            if (lastFile) runDecompose(lastFile, merged);
          }}
          disabled={loading || !lastFile}
        />
      )}

      {stats && (
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer">
            Detected layers ({stats.types.length})
          </summary>
          <ul className="pl-4 mt-2 grid grid-cols-2 gap-x-4">
            {stats.types.map((t, i) => (
              <li key={i} className="font-mono">
                {i + 1}. {t}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex gap-4" style={{ height: '700px' }}>
        {/* Original — matches the canvas height exactly */}
        <div className="border border-gray-300 rounded overflow-hidden flex flex-col w-[380px] shrink-0">
          <div className="px-3 py-2 bg-gray-100 text-sm font-medium border-b border-gray-300 shrink-0">
            Original
          </div>
          <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 overflow-hidden">
            {originalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={originalUrl}
                alt="original"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-gray-400 text-sm">No image uploaded yet</div>
            )}
          </div>
        </div>

        {/* Decomposed — explicit 700px height so Konva gets a real pixel size at init */}
        <div className="border border-gray-300 rounded overflow-hidden flex flex-col flex-1 min-w-0">
          <div className="px-3 py-2 bg-gray-100 text-sm font-medium border-b border-gray-300 shrink-0">
            Decomposed editable template (openpolotno)
          </div>
          <div className="flex-1 polonto min-h-0">
            {/* defaultSection="layers" — Photos was loading indefinitely with
                no polotno API key; now wired to backend mediaList instead. */}
            <RaeditorContainer style={{ width: '100%', height: '660px' }}>
              <SidePanelWrap>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <SidePanel store={store} sections={features as any[]} defaultSection="layers" />
              </SidePanelWrap>
              <WorkspaceWrap>
                <Toolbar store={store} />
                <Workspace store={store} />
                <ZoomButtons store={store} />
              </WorkspaceWrap>
            </RaeditorContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const QualityReportPanel: FC<{
  report: QualityReport;
  onApply: (patch: Partial<Strategies>) => void;
  disabled: boolean;
}> = ({ report, onApply, disabled }) => {
  const tone =
    report.score >= 85
      ? 'bg-green-50 border-green-200 text-green-800'
      : report.score >= 60
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-red-50 border-red-200 text-red-800';
  const badgeTone =
    report.score >= 85
      ? 'bg-green-600'
      : report.score >= 60
      ? 'bg-amber-500'
      : 'bg-red-600';
  return (
    <details className={`border rounded p-3 text-sm ${tone}`} open={report.score < 85}>
      <summary className="cursor-pointer select-none flex items-center gap-3">
        <span
          className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-semibold ${badgeTone}`}
          title="Quality score"
        >
          {report.score}
        </span>
        <span className="font-medium">
          Decomposition quality
          {report.score >= 85
            ? report.issues.length === 0
              ? ' — no auto-detected issues'
              : ' — minor issues'
            : ' — issues to review'}
        </span>
        <span
          className="text-xs opacity-70 ml-auto"
          title="Score reflects automated checks only (text completeness, masks, bbox sanity, color drift). Always review the result against your source — some failure modes are not enumerable statically."
        >
          {report.issues.length} issue{report.issues.length === 1 ? '' : 's'}
          {report.tierBRan ? ' · VLM scorecard ran' : ''}
          {report.refined &&
            (report.refined.ocrAdded + report.refined.subjectsAdded > 0
              ? ` · refined (+${report.refined.ocrAdded} text, +${report.refined.subjectsAdded} subj)`
              : ' · refine ran (no deltas)')}
        </span>
      </summary>
      {report.issues.length > 0 && (
        <>
          {report.issues.some((i) => i.apply) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {report.issues
                .filter((i) => i.apply)
                .map((issue, i) => (
                  <button
                    key={`chip-${i}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => issue.apply && onApply(issue.apply)}
                    className="text-xs bg-white border border-gray-400 rounded-full px-3 py-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={issue.message}
                  >
                    {chipLabel(issue)}
                  </button>
                ))}
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {report.issues.map((issue, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span
                  className={`px-1.5 py-0.5 rounded font-mono ${
                    issue.severity === 'critical'
                      ? 'bg-red-200 text-red-900'
                      : issue.severity === 'warning'
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {issue.severity}
                </span>
                <div className="flex-1">
                  {issue.layer && (
                    <span className="font-mono text-gray-700 mr-1">[{issue.layer}]</span>
                  )}
                  <span>{issue.message}</span>
                  {issue.suggestion && (
                    <div className="text-gray-600 italic mt-0.5">→ {issue.suggestion}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {report.backgroundCandidates && report.backgroundCandidates.candidatesGenerated > 1 && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <div className="text-xs font-semibold mb-2 opacity-80">
            Background recovery — {report.backgroundCandidates.candidatesGenerated} candidates scored
            <span className="font-normal opacity-60 ml-2">colour match · seam smoothness · auto-selected best</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {report.backgroundCandidates.scores.map((s) => {
              const isSelected = s.candidateIndex === report.backgroundCandidates!.selectedIndex;
              return (
                <div
                  key={s.candidateIndex}
                  className={`flex flex-col items-center gap-1 rounded p-1.5 border-2 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white opacity-80'
                  }`}
                >
                  {s.thumbnail && (
                    <div className="relative">
                      <img
                        src={s.thumbnail}
                        alt={`Candidate ${s.candidateIndex + 1}`}
                        className="w-20 h-20 object-cover rounded"
                      />
                      {isSelected && (
                        <span className="absolute top-0.5 right-0.5 bg-blue-600 text-white text-xs rounded px-1 leading-tight">
                          ★
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-center leading-tight">
                    <div className={`text-xs font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                      #{s.candidateIndex + 1} · {s.score}/100
                    </div>
                    <div className="text-xs text-gray-500">
                      🎨 {s.colorScore} · 〰 {s.seamScore}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 mt-1.5 opacity-70">
            🎨 = colour match to source · 〰 = seam smoothness at inpainted text regions
          </div>
        </div>
      )}
    </details>
  );
};

function chipLabel(issue: QualityIssue): string {
  const apply = issue.apply ?? {};
  const parts: string[] = [];
  if (apply.subjectIsolate)
    parts.push(`subject cutout → ${strategyShort(apply.subjectIsolate)}`);
  if (apply.bgRecover)
    parts.push(`bg → ${strategyShort(apply.bgRecover)}`);
  if (apply.ocr) parts.push(`ocr → ${apply.ocr}`);
  if (apply.subjectDetect) parts.push(`subject detect → ${apply.subjectDetect}`);
  return parts.length ? `Apply: ${parts.join(', ')}` : 'Apply suggestion';
}

function strategyShort(s: string): string {
  switch (s) {
    case 'sam2-prompted':
      return 'SAM2';
    case '851-labs':
      return '851-labs';
    case 'nano-banana-text-only':
      return 'Nano Banana';
    case 'keep-source':
      return 'keep source';
    case 'gemini-then-dino':
      return 'Gemini + dino';
    case 'gemini-vision':
      return 'Gemini';
    default:
      return s;
  }
}

const StrategyDropdown: FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs text-gray-600">{label}</span>
    <select
      className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
