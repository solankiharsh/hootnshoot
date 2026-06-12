'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartMultiLine } from '@gitroom/frontend/components/analytics/chart-multi-line';

export const DailyOverviewPanel: FC<{
  integration: Integration;
  fromDate: string;
  toDate: string;
}> = ({ integration, fromDate, toDate }) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const response = await fetch(
      `/analytics/${integration.id}/extended?type=daily&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`
    );
    return response.json();
  }, [fetch, integration.id, fromDate, toDate]);

  const { data } = useSWR(
    `/analytics-daily-${integration.id}-${fromDate}-${toDate}`,
    load
  );

  const { labels, datasets } = useMemo(() => {
    const rows = Array.isArray(data?.days) ? data.days : Array.isArray(data) ? data : [];
    const parsed = rows.slice(-30);
    return {
      labels: parsed.map((row: any) => row.date || row.day || ''),
      datasets: [
        {
          label: 'Posts',
          values: parsed.map((row: any) => Number(row.posts || row.postCount || 0)),
        },
        {
          label: 'Engagement',
          values: parsed.map((row: any) =>
            Number(row.engagement || row.totalEngagement || row.likes || 0)
          ),
        },
      ],
    };
  }, [data]);

  if (!labels.length) {
    return <div className="text-sm opacity-70">No daily overview data in selected range.</div>;
  }

  return (
    <div className="h-[320px] bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]">
      <ChartMultiLine labels={labels} datasets={datasets} />
    </div>
  );
};
