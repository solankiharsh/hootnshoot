'use client';

import { FC, useCallback } from 'react';
import useSWR from 'swr';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export const GBPPanel: FC<{
  integration: Integration;
  fromDate: string;
  toDate: string;
}> = ({ integration, fromDate, toDate }) => {
  const fetch = useFetch();

  const loadPerformance = useCallback(async () => {
    const response = await fetch(
      `/analytics/${integration.id}/gbp-performance?startDate=${encodeURIComponent(fromDate)}&endDate=${encodeURIComponent(toDate)}`
    );
    return response.json();
  }, [fetch, integration.id, fromDate, toDate]);

  const loadKeywords = useCallback(async () => {
    const startMonth = fromDate.slice(0, 7);
    const endMonth = toDate.slice(0, 7);
    const response = await fetch(
      `/analytics/${integration.id}/gbp-keywords?startMonth=${encodeURIComponent(startMonth)}&endMonth=${encodeURIComponent(endMonth)}`
    );
    return response.json();
  }, [fetch, integration.id, fromDate, toDate]);

  const { data: performance } = useSWR(
    `/analytics-gbp-performance-${integration.id}-${fromDate}-${toDate}`,
    loadPerformance
  );
  const { data: keywords } = useSWR(
    `/analytics-gbp-keywords-${integration.id}-${fromDate}-${toDate}`,
    loadKeywords
  );

  const cards = [
    { label: 'Impressions', value: performance?.impressions || performance?.totalImpressions || 0 },
    { label: 'Website Clicks', value: performance?.websiteClicks || 0 },
    { label: 'Calls', value: performance?.callClicks || performance?.calls || 0 },
    { label: 'Directions', value: performance?.directionRequests || 0 },
  ];

  const keywordRows = Array.isArray(keywords?.data)
    ? keywords.data
    : Array.isArray(keywords)
    ? keywords
    : [];

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[12px]">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]"
          >
            <div className="text-[12px] opacity-70">{card.label}</div>
            <div className="text-[28px] font-semibold">{Number(card.value || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="bg-newTableHeader border border-newTableBorder rounded-[12px] overflow-hidden">
        <div className="px-[12px] py-[10px] border-b border-newTableBorder text-[14px] font-medium">
          Search Keywords
        </div>
        <div className="max-h-[280px] overflow-auto">
          {!keywordRows.length ? (
            <div className="px-[12px] py-[14px] text-sm opacity-70">No keyword data available.</div>
          ) : (
            keywordRows.map((row: any, idx: number) => (
              <div
                key={`${row.keyword || 'kw'}-${idx}`}
                className="px-[12px] py-[10px] border-b border-newTableBorder last:border-b-0 flex items-center justify-between"
              >
                <div>{row.keyword || row.term || 'Unknown'}</div>
                <div className="opacity-80">{Number(row.impressions || row.count || 0).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
