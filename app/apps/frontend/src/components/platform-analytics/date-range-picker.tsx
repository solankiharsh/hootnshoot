'use client';

import { FC, useMemo } from 'react';
import dayjs from 'dayjs';

type PresetKey = 7 | 14 | 30 | 90 | 180 | 'custom';

export type DateRangeValue = {
  fromDate: string;
  toDate: string;
  preset: PresetKey;
};

const PRESETS: Array<{ key: PresetKey; label: string; days?: number }> = [
  { key: 7, label: '7d', days: 7 },
  { key: 14, label: '14d', days: 14 },
  { key: 30, label: '30d', days: 30 },
  { key: 90, label: '90d', days: 90 },
  { key: 180, label: '180d', days: 180 },
  { key: 'custom', label: 'Custom' },
];

export function getPresetRange(days: number): DateRangeValue {
  const toDate = dayjs().format('YYYY-MM-DD');
  const fromDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
  return {
    fromDate,
    toDate,
    preset: days as PresetKey,
  };
}

export const DateRangePicker: FC<{
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  allowedPresetDays?: number[];
}> = ({ value, onChange, allowedPresetDays = [7, 30, 90] }) => {
  const enabledPresets = useMemo(() => {
    const allowed = new Set(allowedPresetDays);
    return PRESETS.filter((preset) =>
      preset.key === 'custom' ? true : allowed.has(preset.key)
    );
  }, [allowedPresetDays]);

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex flex-wrap gap-[8px]">
        {enabledPresets.map((preset) => {
          const active = value.preset === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                if (preset.key === 'custom') {
                  onChange({ ...value, preset: 'custom' });
                  return;
                }
                onChange(getPresetRange(preset.key));
              }}
              className={[
                'px-[10px] py-[6px] rounded-[8px] text-[13px] border transition-colors',
                active
                  ? 'bg-[#612bd3] text-white border-[#612bd3]'
                  : 'bg-newTableHeader border-newTableBorder hover:border-[#612bd3]/40',
              ].join(' ')}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-[8px]">
          <input
            type="date"
            value={value.fromDate}
            max={value.toDate}
            onChange={(e) =>
              onChange({
                ...value,
                preset: 'custom',
                fromDate: e.target.value,
              })
            }
            className="bg-newTableHeader border border-newTableBorder rounded-[8px] px-[10px] py-[6px]"
          />
          <span className="text-[12px] opacity-70">to</span>
          <input
            type="date"
            value={value.toDate}
            min={value.fromDate}
            max={dayjs().format('YYYY-MM-DD')}
            onChange={(e) =>
              onChange({
                ...value,
                preset: 'custom',
                toDate: e.target.value,
              })
            }
            className="bg-newTableHeader border border-newTableBorder rounded-[8px] px-[10px] py-[6px]"
          />
        </div>
      )}
    </div>
  );
};
