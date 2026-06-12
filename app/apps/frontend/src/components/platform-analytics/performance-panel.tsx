'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartDecay } from '@gitroom/frontend/components/analytics/chart-decay';
import { ChartBar } from '@gitroom/frontend/components/analytics/chart-bar';

export const PerformancePanel: FC<{
  integration: Integration;
}> = ({ integration }) => {
  const fetch = useFetch();

  const loadDecay = useCallback(async () => {
    const response = await fetch(
      `/analytics/${integration.id}/extended?type=decay`
    );
    return response.json();
  }, [fetch, integration.id]);

  const loadFrequency = useCallback(async () => {
    const response = await fetch(
      `/analytics/${integration.id}/extended?type=frequency`
    );
    return response.json();
  }, [fetch, integration.id]);

  const { data: decay } = useSWR(`/analytics-decay-${integration.id}`, loadDecay);
  const { data: frequency } = useSWR(
    `/analytics-frequency-${integration.id}`,
    loadFrequency
  );

  const decaySeries = useMemo(() => {
    const rows = Array.isArray(decay?.buckets)
      ? decay.buckets
      : Array.isArray(decay)
      ? decay
      : [];
    return {
      labels: rows.map((row: any) => row.label || row.window || row.bucket || ''),
      values: rows.map((row: any) => Number(row.percent || row.value || row.total || 0)),
    };
  }, [decay]);

  const frequencySeries = useMemo(() => {
    const rows = Array.isArray(frequency?.rows)
      ? frequency.rows
      : Array.isArray(frequency)
      ? frequency
      : [];
    return {
      labels: rows.map((row: any) => String(row.postsPerWeek ?? row.frequency ?? '0')),
      values: rows.map((row: any) =>
        Number(row.engagementRate ?? row.avgEngagement ?? row.value ?? 0)
      ),
    };
  }, [frequency]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[12px]">
      <div className="bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]">
        <div className="text-[14px] font-medium mb-[8px]">Content Performance Decay</div>
        {decaySeries.labels.length ? (
          <div className="h-[260px]">
            <ChartDecay labels={decaySeries.labels} values={decaySeries.values} />
          </div>
        ) : (
          <div className="text-sm opacity-70">No decay data available.</div>
        )}
      </div>

      <div className="bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]">
        <div className="text-[14px] font-medium mb-[8px]">Frequency vs Engagement</div>
        {frequencySeries.labels.length ? (
          <div className="h-[260px]">
            <ChartBar
              labels={frequencySeries.labels}
              values={frequencySeries.values}
              label="Engagement rate"
            />
          </div>
        ) : (
          <div className="text-sm opacity-70">No posting frequency data available.</div>
        )}
      </div>
    </div>
  );
};
