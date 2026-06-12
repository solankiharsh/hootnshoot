'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartBar } from '@gitroom/frontend/components/analytics/chart-bar';

const DIMENSIONS = ['age', 'gender', 'city', 'country'] as const;

export const DemographicsPanel: FC<{
  integration: Integration;
}> = ({ integration }) => {
  const [dimension, setDimension] = useState<(typeof DIMENSIONS)[number]>('age');
  const fetch = useFetch();

  const load = useCallback(async () => {
    const response = await fetch(
      `/analytics/${integration.id}/demographics?dimension=${dimension}`
    );
    return response.json();
  }, [fetch, integration.id, dimension]);

  const { data } = useSWR(
    `/analytics-demographics-${integration.id}-${dimension}`,
    load
  );

  const { labels, values } = useMemo(() => {
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.[dimension])
      ? data[dimension]
      : Array.isArray(data)
      ? data
      : [];
    const top = list.slice(0, 12);
    return {
      labels: top.map((row: any) => row.label || row.name || row.key || 'unknown'),
      values: top.map((row: any) => Number(row.value || row.count || row.total || 0)),
    };
  }, [data, dimension]);

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex gap-[8px] flex-wrap">
        {DIMENSIONS.map((dim) => (
          <button
            key={dim}
            type="button"
            onClick={() => setDimension(dim)}
            className={[
              'px-[10px] py-[6px] rounded-[8px] text-[13px] border transition-colors',
              dim === dimension
                ? 'bg-[#612bd3] text-white border-[#612bd3]'
                : 'bg-newTableHeader border-newTableBorder hover:border-[#612bd3]/40',
            ].join(' ')}
          >
            {dim}
          </button>
        ))}
      </div>
      {labels.length ? (
        <div className="h-[320px] bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]">
          <ChartBar labels={labels} values={values} label={dimension} />
        </div>
      ) : (
        <div className="text-sm opacity-70">No demographic data available.</div>
      )}
    </div>
  );
};
