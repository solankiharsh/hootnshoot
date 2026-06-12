'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartMultiLine } from '@gitroom/frontend/components/analytics/chart-multi-line';

export const FollowersPanel: FC<{
  integration: Integration;
}> = ({ integration }) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const response = await fetch(
      `/analytics/${integration.id}/extended?type=followers`
    );
    return response.json();
  }, [fetch, integration.id]);

  const { data } = useSWR(`/analytics-followers-${integration.id}`, load);

  const { labels, datasets } = useMemo(() => {
    const rows = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.history)
      ? data.history
      : Array.isArray(data)
      ? data
      : [];
    return {
      labels: rows.map((row: any) => row.date || row.day || ''),
      datasets: [
        {
          label: 'Followers',
          values: rows.map((row: any) =>
            Number(row.followers || row.total || row.count || 0)
          ),
        },
        {
          label: 'Gained',
          values: rows.map((row: any) => Number(row.followers_gained || row.gained || 0)),
        },
        {
          label: 'Lost',
          values: rows.map((row: any) => Number(row.followers_lost || row.lost || 0)),
        },
      ],
    };
  }, [data]);

  if (!labels.length) {
    return <div className="text-sm opacity-70">No follower history available for this account.</div>;
  }

  return (
    <div className="h-[320px] bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]">
      <ChartMultiLine labels={labels} datasets={datasets} />
    </div>
  );
};
