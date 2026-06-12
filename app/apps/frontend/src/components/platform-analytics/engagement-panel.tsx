'use client';

import { FC, useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { RenderAnalytics } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

export const EngagementPanel: FC<{
  integration: Integration;
  fromDate: string;
  toDate: string;
}> = ({ integration, fromDate, toDate }) => {
  const fetch = useFetch();
  const cacheKey = `/analytics-${integration.id}-${fromDate}-${toDate}`;

  const load = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(
        `/analytics/${integration.id}?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`,
        { signal: controller.signal }
      );
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }, [fetch, integration.id, fromDate, toDate]);

  const cachedFallback = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      // Ignore cached empty arrays — they cause the reconnect-loop bug.
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.removeItem(cacheKey);
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }, [cacheKey]);

  const { data, isValidating } = useSWR(cacheKey, load, {
    refreshInterval: 0,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: true,
    refreshWhenOffline: false,
    revalidateOnMount: true,
    fallbackData: cachedFallback,
  });

  useEffect(() => {
    // Never cache empty arrays — a stale [] would immediately show the "reconnect"
    // empty state before the real fetch completes, triggering an OAuth loop.
    if (!Array.isArray(data) || data.length === 0) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // ignore localStorage failures
    }
  }, [cacheKey, data]);

  const days = useMemo(() => {
    const diff = Math.ceil(
      (new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000
    );
    return Math.max(1, diff);
  }, [fromDate, toDate]);

  // Show spinner while:
  // - data hasn't arrived yet (undefined), OR
  // - data is empty [] AND a real fetch is still in-flight (stale cache hit)
  // This prevents a cached [] from immediately showing the reconnect button.
  if (data === undefined || (Array.isArray(data) && data.length === 0 && isValidating)) {
    return (
      <div className="flex items-center justify-center py-[48px]">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <RenderAnalytics
      integration={integration}
      date={days}
      initialData={data}
      disableFetch={true}
    />
  );
};
