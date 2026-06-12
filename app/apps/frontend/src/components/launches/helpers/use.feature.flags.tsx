'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';
import useSWR from 'swr';

export type FeatureFlags = {
  complianceEnabled: boolean;
};

const FALLBACK: FeatureFlags = { complianceEnabled: false };

export const useFeatureFlags = () => {
  const fetch = useFetch();

  const load = useCallback(async (): Promise<FeatureFlags> => {
    try {
      const r = await fetch('/public/feature-flags');
      if (!r.ok) return FALLBACK;
      return (await r.json()) as FeatureFlags;
    } catch {
      return FALLBACK;
    }
  }, [fetch]);

  const { data } = useSWR('feature-flags', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: FALLBACK,
  });

  return data ?? FALLBACK;
};
