'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartBar } from '@gitroom/frontend/components/analytics/chart-bar';

export const AccountInsightsPanel: FC<{
  integration: Integration;
  fromDate: string;
  toDate: string;
}> = ({ integration, fromDate, toDate }) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const response = await fetch(
      `/analytics/${integration.id}/account-insights?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`
    );
    return response.json();
  }, [fetch, integration.id, fromDate, toDate]);

  const { data } = useSWR(
    `/analytics-account-insights-${integration.id}-${fromDate}-${toDate}`,
    load
  );

  const metrics = useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data?.metrics)) return data.metrics;
    if (Array.isArray(data)) return data;
    return Object.entries(data)
      .filter(([, value]) => typeof value === 'number')
      .map(([key, value]) => ({ key, value }));
  }, [data]);

  const labels = metrics.slice(0, 12).map((metric: any) => metric.key || metric.label);
  const values = metrics
    .slice(0, 12)
    .map((metric: any) => Number(metric.value ?? metric.total ?? 0));

  if (!labels.length) {
    return <div className="text-sm opacity-70">No account-level insights available.</div>;
  }

  return (
    <div className="h-[340px] bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]">
      <ChartBar labels={labels} values={values} label="Account insights" />
    </div>
  );
};
