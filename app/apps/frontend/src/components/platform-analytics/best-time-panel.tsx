'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartHeatmap } from '@gitroom/frontend/components/analytics/chart-heatmap';

const DAYS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export const BestTimePanel: FC<{
  integration: Integration;
}> = ({ integration }) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const response = await fetch(
      `/analytics/${integration.id}/extended?type=best-time`
    );
    return response.json();
  }, [fetch, integration.id]);

  const { data } = useSWR(`/analytics-best-time-${integration.id}`, load);

  const points = useMemo(() => {
    const rows = Array.isArray(data?.slots)
      ? data.slots
      : Array.isArray(data)
      ? data
      : [];
    return rows.map((row: any) => ({
      day: DAYS[String(row.day || '').toLowerCase()] || 'Mon',
      hour: Number(row.hour ?? row.hourOfDay ?? 0),
      score: Number(row.score ?? row.engagement ?? row.avgEngagement ?? 0),
    }));
  }, [data]);

  if (!points.length) {
    return <div className="text-sm opacity-70">No best-time slots available yet.</div>;
  }

  return (
    <div className="bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]">
      <ChartHeatmap points={points} />
    </div>
  );
};
