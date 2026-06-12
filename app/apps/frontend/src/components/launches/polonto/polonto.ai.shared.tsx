'use client';

import { ReactNode } from 'react';

export const GENERATE_PROMPT_CHIPS = [
  'Red apple on white background',
  'Minimal product photo, soft shadows',
  'Social media graphic, bold typography',
  'Abstract gradient background',
] as const;

export function AIPanelHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-gray-900 leading-tight m-0">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[12px] text-gray-500 mt-1 mb-0 leading-snug">{subtitle}</p>
        )}
      </div>
      {badge}
    </div>
  );
}

export function CreditsBadge({ credits }: { credits?: number }) {
  if (credits == null) return null;
  const low = credits <= 10;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border ${
        low
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-violet-50 text-violet-700 border-violet-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${low ? 'bg-amber-500' : 'bg-violet-500'}`} />
      {credits} left
    </span>
  );
}

export function AIPanelSection({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-4 ${className}`}>
      {title && (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2 m-0">
          {title}
        </p>
      )}
      {children}
    </section>
  );
}

export function PromptField({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
    />
  );
}

export function PromptChips({
  chips,
  onPick,
  disabled,
}: {
  chips: readonly string[];
  onPick: (chip: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={() => onPick(chip)}
          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export function AIErrorBanner({ message }: { message: string }) {
  return (
    <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 m-0">
      {message}
    </p>
  );
}

export function AIToolCard({
  title,
  description,
  accent,
  onClick,
}: {
  title: string;
  description: string;
  accent: 'violet' | 'rose';
  onClick: () => void;
}) {
  const accentClasses =
    accent === 'violet'
      ? 'border-violet-200 hover:border-violet-300 hover:bg-violet-50/80 group-hover:shadow-violet-100'
      : 'border-rose-200 hover:border-rose-300 hover:bg-rose-50/80 group-hover:shadow-rose-100';

  const iconClasses =
    accent === 'violet'
      ? 'bg-violet-100 text-violet-700'
      : 'bg-rose-100 text-rose-700';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-start text-left w-full rounded-xl border bg-white p-3 transition-all shadow-sm hover:shadow-md ${accentClasses}`}
    >
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[14px] font-semibold mb-2 ${iconClasses}`}
      >
        {accent === 'violet' ? '✎' : '⌫'}
      </span>
      <span className="text-[13px] font-semibold text-gray-900">{title}</span>
      <span className="text-[11px] text-gray-500 mt-0.5 leading-snug">{description}</span>
    </button>
  );
}

export function AIBackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        aria-label="Back"
      >
        ←
      </button>
      <span className="text-[13px] font-semibold text-gray-900">{label}</span>
    </div>
  );
}

export function ImageCompareFrame({
  label,
  src,
  emptyLabel,
  loading,
}: {
  label: string;
  src?: string | null;
  emptyLabel?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 m-0">
        {label}
      </p>
      <div className="relative flex flex-1 min-h-[120px] items-center justify-center rounded-lg border border-gray-200 bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0px] p-2">
        {loading ? (
          <span className="text-[12px] text-gray-500 animate-pulse">Working…</span>
        ) : src ? (
          <img
            src={src}
            alt={label}
            loading="lazy"
            className="max-h-[160px] max-w-full rounded-md object-contain shadow-sm"
          />
        ) : (
          <span className="text-[11px] text-gray-400 text-center px-2">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

export function GenerateSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse">
      <div className="aspect-square max-h-[200px] w-full rounded-lg bg-gray-200 mx-auto" />
      <p className="text-center text-[11px] text-gray-400 mt-3 mb-0">Generating your image…</p>
    </div>
  );
}

export function PrimaryAction({
  children,
  onClick,
  loading,
  disabled,
  variant = 'primary',
}: {
  children: ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success';
}) {
  const variants = {
    primary: 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-200',
    secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
