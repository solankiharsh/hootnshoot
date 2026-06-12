'use client';

/**
 * Content Cop compliance gate for scheduling flows (ManageModal, calendar reopen).
 * Create-post (Gener8) does not use ManageModal; reuse this panel if a future path schedules posts.
 */

import React, {
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';

const COMPLIANCE_GATE_SEEN_KEY = 'compliance_gate_seen';

export interface ComplianceJobDto {
  id: string;
  externalJobId?: string;
  status: string;
  decision: string | null;
  score: number | null;
  violations?: unknown;
  suggestedEdits?: unknown;
}

export type ComplianceGatePhase =
  | 'idle'
  | 'submitting'
  | 'waiting'
  | 'approved'
  | 'rejected'
  | 'manual_review'
  | 'failed'
  | 'timeout'
  | 'rate_limited'
  | 'busy';

export interface ComplianceGatePanelProps {
  postGroupId: string;
  platform: string;
  onApproved: () => void;
  onClose: () => void;
  initialJob?: ComplianceJobDto | null;
  /** Opens the post editor; saving the post queues a new Content Cop check. */
  onFix?: () => void;
  /** Skip the idle "Run Compliance Check" button and start automatically. */
  autoSubmit?: boolean;
}

function phaseFromJob(j: ComplianceJobDto | null): ComplianceGatePhase | null {
  if (!j) return null;
  if (j.status === 'pending' || j.status === 'running') return 'waiting';
  if (j.status === 'completed') {
    if (j.decision === 'Approved') return 'approved';
    if (j.decision === 'Needs Compliance Review') return 'manual_review';
    return 'rejected';
  }
  if (j.status === 'timeout') return 'timeout';
  if (j.status === 'failed' || j.status === 'cancelled') return 'failed';
  return null;
}

function parseViolations(
  raw: unknown
): Array<{ severity: string; rule: string; excerpt: string; checkType: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => ({
    severity: String((v as Record<string, unknown>)?.severity ?? ''),
    rule: String((v as Record<string, unknown>)?.rule ?? ''),
    excerpt: String((v as Record<string, unknown>)?.excerpt ?? ''),
    checkType: String((v as Record<string, unknown>)?.check_type ?? ''),
  }));
}

const GATE_SEVERITY: Record<string, { badge: string; dot: string; border: string }> = {
  critical: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-500', border: 'border-red-500/20' },
  major:    { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-400', border: 'border-orange-500/20' },
  minor:    { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400', border: 'border-yellow-500/20' },
};

function parseSuggestedEdits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) =>
    typeof v === 'string' ? v : JSON.stringify(v)
  );
}

function nestErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const m = (body as { message?: unknown }).message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m)) {
    const joined = m.map(String).filter(Boolean).join(', ');
    return joined || null;
  }
  return null;
}

export const ComplianceGatePanel: FC<ComplianceGatePanelProps> = ({
  postGroupId,
  platform,
  onApproved,
  onClose,
  initialJob = null,
  onFix,
  autoSubmit = false,
}) => {
  const fetchJson = useFetch();
  const initialPhase = phaseFromJob(initialJob ?? null);
  const [phase, setPhase] = useState<ComplianceGatePhase>(
    initialPhase ?? 'idle'
  );
  const [job, setJob] = useState<ComplianceJobDto | null>(initialJob ?? null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [showExplainer, setShowExplainer] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(COMPLIANCE_GATE_SEEN_KEY);
  });
  const [suggestedOpen, setSuggestedOpen] = useState(true);
  const [expandedViolation, setExpandedViolation] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const approvedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const dismissExplainer = useCallback(() => {
    try {
      localStorage.setItem(COMPLIANCE_GATE_SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowExplainer(false);
  }, []);

  const pollStatus = useCallback(async () => {
    if (!job?.id) return;
    try {
      const res = await fetchJson(`/compliance/status/${job.id}`);
      const updated = (await res.json()) as ComplianceJobDto;
      setJob(updated);
      if (updated.status === 'completed') {
        clearPoll();
        if (updated.decision === 'Approved') setPhase('approved');
        else if (updated.decision === 'Needs Compliance Review')
          setPhase('manual_review');
        else setPhase('rejected');
      } else if (['failed', 'cancelled', 'timeout'].includes(updated.status)) {
        clearPoll();
        setPhase(updated.status === 'timeout' ? 'timeout' : 'failed');
      }
    } catch {
      clearPoll();
      setPhase('failed');
    }
  }, [job?.id, fetchJson, clearPoll]);

  const submit = useCallback(async () => {
    setLastError(null);
    setPhase('submitting');
    try {
      const res = await fetchJson('/compliance/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postGroupId, platform }),
      });
      if (res.status === 429) {
        setPhase('rate_limited');
        return;
      }
      if (res.status === 503) {
        const body = (await res.json().catch(() => ({}))) as {
          retryAfter?: number;
        };
        const raw = body.retryAfter;
        const sec =
          typeof raw === 'number' && Number.isFinite(raw)
            ? Math.max(0, Math.floor(raw))
            : 5;
        setRetryCountdown(sec);
        setPhase('busy');
        return;
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setLastError(nestErrorMessage(errBody));
        setPhase('failed');
        return;
      }
      const { jobId } = (await res.json()) as { jobId?: string };
      if (!jobId) {
        setLastError('No job id returned from the server.');
        setPhase('failed');
        return;
      }
      const jobRes = await fetchJson(`/compliance/status/${jobId}`);
      const nextJob = (await jobRes.json()) as ComplianceJobDto;
      setJob(nextJob);
      setPhase('waiting');
    } catch {
      setLastError('Network error. Check your connection and try again.');
      setPhase('failed');
    }
  }, [fetchJson, postGroupId, platform]);

  const autoSubmitFiredRef = useRef(false);
  useEffect(() => {
    if (!autoSubmit || phase !== 'idle' || autoSubmitFiredRef.current) return;
    autoSubmitFiredRef.current = true;
    void submit();
  }, [autoSubmit, phase, submit]);

  const hydratedInitialRef = useRef(false);
  useEffect(() => {
    if (!initialJob?.id || hydratedInitialRef.current) {
      return undefined;
    }
    hydratedInitialRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchJson(`/compliance/status/${initialJob.id}`);
        if (!res.ok || cancelled) return;
        const full = (await res.json()) as ComplianceJobDto;
        if (cancelled) return;
        setJob(full);
        const p = phaseFromJob(full);
        if (p) setPhase(p);
      } catch {
        /* keep initial snapshot */
      }
    })();
    return () => {
      cancelled = true;
      hydratedInitialRef.current = false;
    };
  }, [initialJob?.id, fetchJson]);

  useEffect(() => {
    if (phase !== 'waiting' || !job?.id) {
      return undefined;
    }
    void pollStatus();
    pollIntervalRef.current = setInterval(() => {
      void pollStatus();
    }, 8000);
    return () => {
      clearPoll();
    };
  }, [phase, job?.id, pollStatus, clearPoll]);

  useEffect(() => {
    if (phase !== 'approved') {
      return undefined;
    }
    approvedTimerRef.current = setTimeout(() => {
      onApproved();
    }, 1500);
    return () => {
      if (approvedTimerRef.current) {
        clearTimeout(approvedTimerRef.current);
        approvedTimerRef.current = null;
      }
    };
  }, [phase, onApproved]);

  useEffect(() => {
    if (phase !== 'busy' || retryCountdown === null) {
      return undefined;
    }
    if (retryCountdown <= 0) {
      void submit();
      return undefined;
    }
    const t = setTimeout(() => {
      setRetryCountdown((c) => (c === null ? null : c - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, retryCountdown, submit]);

  useEffect(
    () => () => {
      clearPoll();
      if (approvedTimerRef.current) clearTimeout(approvedTimerRef.current);
    },
    [clearPoll]
  );

  const violations = parseViolations(job?.violations);
  const suggestedEdits = parseSuggestedEdits(job?.suggestedEdits);

  return (
    <div className="flex flex-col gap-[20px] text-textColor max-w-[560px] mx-auto py-[20px] px-[8px]">
      {showExplainer && phase === 'idle' && (
        <div className="rounded-[10px] border border-newTableBorder bg-newSettings p-[14px] text-[14px] flex flex-col gap-[10px]">
          <p>
            Posts are reviewed against your brand guidelines before
            publishing.
          </p>
          <Button type="button" className="self-start" onClick={dismissExplainer}>
            Got it
          </Button>
        </div>
      )}

      {phase === 'idle' && (
        <>
          <p className="text-[15px] leading-relaxed">
            Check content compliance before publishing. Posts are reviewed against
            your brand guidelines.
          </p>
          <Button type="button" onClick={() => void submit()}>
            Run Compliance Check
          </Button>
        </>
      )}

      {phase === 'submitting' && (
        <div className="flex items-center gap-[12px] text-[15px]">
          <div className="h-[22px] w-[22px] rounded-full border-2 border-btnPrimary border-t-transparent animate-spin" />
          Submitting to Content Cop…
        </div>
      )}

      {phase === 'waiting' && (
        <div className="flex flex-col gap-[12px]">
          <p className="text-[15px]">Analyzing content against brand guidelines…</p>
          <div className="h-[6px] w-full rounded-full bg-newColColor overflow-hidden">
            <div className="h-full w-[40%] bg-btnPrimary animate-pulse rounded-full" />
          </div>
          {job?.externalJobId ? (
            <p className="text-[12px] text-textColor/50">
              Job {job.externalJobId}
            </p>
          ) : null}
          <p className="text-[13px] text-textColor/70">
            Results typically arrive within 1–3 minutes
          </p>
          <p className="text-[12px] text-textColor/55 leading-relaxed">
            This screen updates when your server receives a webhook from Content
            Cop. The bar above is only a visual indicator, not live progress. If
            you run the API on a URL that the public internet cannot reach (for
            example plain localhost), the job will stay here until it times out
            after about 15 minutes—use a deployed API URL or a tunnel and set
            NEXT_PUBLIC_BACKEND_URL (or CONTENT_COP_WEBHOOK_PUBLIC_URL) accordingly.
          </p>
        </div>
      )}

      {phase === 'approved' && (
        <div className="flex flex-col gap-[10px] items-start">
          <CheckCircle2 className="text-green-500 w-[40px] h-[40px]" />
          <p className="text-[16px] font-[600] text-green-600">
            Compliance check passed
          </p>
          {job?.score != null ? (
            <p className="text-[14px]">Score: {job.score}/100</p>
          ) : null}
        </div>
      )}

      {phase === 'rejected' && (
        <div className="flex flex-col gap-[14px]">
          {/* Score + decision header */}
          <div className="flex items-center gap-[14px] rounded-[10px] border border-red-500/30 bg-red-500/8 px-[16px] py-[12px]">
            <div className="flex flex-col items-center justify-center w-[50px] h-[50px] rounded-full border-2 border-red-500/60 shrink-0">
              <span className="text-[17px] font-[700] leading-none text-red-400">{job?.score ?? '—'}</span>
              <span className="text-[10px] text-red-400/70 font-[500]">/100</span>
            </div>
            <div>
              <p className="text-[14px] font-[700] text-red-400">Rejected</p>
              <p className="text-[12px] text-textItemBlur mt-[2px]">
                {violations.length} violation{violations.length !== 1 ? 's' : ''} · edit and recheck to approve
              </p>
            </div>
          </div>

          {/* Violations */}
          {violations.length > 0 && (
            <div className="flex flex-col gap-[6px]">
              <p className="text-[11px] font-[700] uppercase tracking-widest text-textItemBlur">Violations</p>
              {violations.map((v, i) => {
                const style = GATE_SEVERITY[v.severity.toLowerCase()] ?? GATE_SEVERITY.minor;
                const isOpen = expandedViolation === i;
                const excerptClean = v.excerpt.replace(/^###.*\n/, '').replace(/\*\*/g, '').trim();
                return (
                  <div key={i} className={clsx('rounded-[8px] border overflow-hidden', style.border)}>
                    <button
                      type="button"
                      className="w-full flex items-start gap-[10px] px-[12px] py-[10px] text-left hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setExpandedViolation(isOpen ? null : i)}
                    >
                      <span className={clsx('mt-[4px] w-[6px] h-[6px] rounded-full shrink-0', style.dot)} />
                      <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                        <div className="flex items-center gap-[6px] flex-wrap">
                          <span className={clsx('text-[10px] font-[700] uppercase tracking-wide px-[5px] py-[1px] rounded-[4px] border', style.badge)}>
                            {v.severity}
                          </span>
                          <span className="text-[12px] font-[600] text-textColor capitalize">{v.rule}</span>
                          {v.checkType && (
                            <span className="text-[10px] px-[5px] py-[1px] rounded-[4px] bg-white/8 border border-white/10 text-textItemBlur">
                              {v.checkType}
                            </span>
                          )}
                        </div>
                        <p className={clsx('text-[12px] text-textItemBlur leading-snug', !isOpen && 'line-clamp-2')}>
                          {excerptClean}
                        </p>
                      </div>
                      <span className={clsx('text-textItemBlur shrink-0 text-[10px] mt-[2px] transition-transform', isOpen && 'rotate-180')}>▾</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Suggested edits */}
          {suggestedEdits.length > 0 && (
            <div className="flex flex-col gap-[6px]">
              <button
                type="button"
                className="flex items-center gap-[6px] text-[11px] font-[700] uppercase tracking-widest text-textItemBlur hover:text-newTextColor transition-colors cursor-pointer"
                onClick={() => setSuggestedOpen((o) => !o)}
              >
                <span className={clsx('text-[10px] transition-transform', suggestedOpen && 'rotate-180')}>▾</span>
                Suggested edits ({suggestedEdits.length})
              </button>
              {suggestedOpen && (
                <ol className="flex flex-col gap-[8px] ps-[2px]">
                  {suggestedEdits.map((s, i) => (
                    <li key={i} className="flex gap-[10px] text-[12px] text-textColor leading-snug">
                      <span className="shrink-0 w-[18px] h-[18px] rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-[10px] font-[700] text-textItemBlur mt-[1px]">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-[10px] pt-[4px]">
            {onFix ? (
              <Button type="button" onClick={() => onFix()}>
                Fix post
              </Button>
            ) : (
              <Button type="button" onClick={onClose}>
                Edit post
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === 'manual_review' && (
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-start gap-[10px]">
            <Clock className="text-amber-500 w-[36px] h-[36px] shrink-0" />
            <div className="flex flex-col gap-[10px] text-[14px] leading-relaxed">
              <p className="text-[16px] font-[600] text-amber-600">
                Your content has been flagged for manual compliance review.
              </p>
              <p>
                The compliance team will review this submission. This typically
                takes 1–2 business days. You can save this post as a draft in the
                meantime.
              </p>
              {job?.score != null ? (
                <p>Score: {job.score}/100</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-[10px]">
            <Button type="button" onClick={onClose}>
              Close
            </Button>
            {onFix ? (
              <Button type="button" onClick={() => onFix()}>
                Fix
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {phase === 'failed' && (
        <div className="flex flex-col gap-[12px]">
          <p className="text-[15px]">Compliance check encountered an error.</p>
          {lastError ? (
            <p className="text-[14px] text-red-600/90 whitespace-pre-wrap">
              {lastError}
            </p>
          ) : null}
          <div className="flex gap-[10px] flex-wrap">
            <Button
              type="button"
              onClick={() => {
                setLastError(null);
                setJob(null);
                setPhase('idle');
              }}
            >
              Try again
            </Button>
            <Button secondary type="button" onClick={onClose}>
              Save as draft
            </Button>
            {onFix ? (
              <Button type="button" onClick={() => onFix()}>
                Fix
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {phase === 'timeout' && (
        <div className="flex flex-col gap-[12px]">
          <p className="text-[15px]">
            No response received within 15 minutes. The webhook may have been
            lost.
          </p>
          <div className="flex gap-[10px] flex-wrap">
            <Button
              type="button"
              onClick={() => {
                setJob(null);
                setPhase('idle');
              }}
            >
              Try again
            </Button>
            <Button secondary type="button" onClick={onClose}>
              Save as draft
            </Button>
            {onFix ? (
              <Button type="button" onClick={() => onFix()}>
                Fix
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {phase === 'rate_limited' && (
        <div className="flex flex-col gap-[12px]">
          <p className="text-[15px]">
            Content Cop rate limit reached. Please wait a moment and try again.
          </p>
          <Button
            type="button"
            onClick={() => {
              setTimeout(() => {
                setJob(null);
                setPhase('idle');
              }, 800);
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {phase === 'busy' && retryCountdown !== null && (
        <div className="text-[15px]">
          Content Cop is at capacity. Retrying in {retryCountdown}s
        </div>
      )}
    </div>
  );
};
