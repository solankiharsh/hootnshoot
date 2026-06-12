'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import { capitalize, orderBy } from 'lodash';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import useCookie from 'react-use-cookie';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  DateRangePicker,
  DateRangeValue,
  getPresetRange,
} from '@gitroom/frontend/components/platform-analytics/date-range-picker';
import { EngagementPanel } from '@gitroom/frontend/components/platform-analytics/engagement-panel';
import { DailyOverviewPanel } from '@gitroom/frontend/components/platform-analytics/daily-overview-panel';
import { FollowersPanel } from '@gitroom/frontend/components/platform-analytics/followers-panel';
import { DemographicsPanel } from '@gitroom/frontend/components/platform-analytics/demographics-panel';
import { BestTimePanel } from '@gitroom/frontend/components/platform-analytics/best-time-panel';
import { PerformancePanel } from '@gitroom/frontend/components/platform-analytics/performance-panel';
import { AccountInsightsPanel } from '@gitroom/frontend/components/platform-analytics/account-insights-panel';
import { GBPPanel } from '@gitroom/frontend/components/platform-analytics/gbp-panel';

const allowedIntegrations = [
  'facebook',
  'instagram',
  'instagram-standalone',
  'linkedin-page',
  'tiktok',
  'youtube',
  'gmb',
  'pinterest',
  'threads',
  'x',
];

const TAB_IDS = [
  'engagement',
  'overview',
  'followers',
  'audience',
  'best-time',
  'performance',
  'account-insights',
  'gbp',
] as const;

type TabId = (typeof TAB_IDS)[number];

export const PlatformAnalytics = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const { disableXAnalytics } = useVariables();

  const [current, setCurrent] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('engagement');
  const [dateRange, setDateRange] = useState<DateRangeValue>(getPresetRange(7));
  const [refresh, setRefresh] = useState(false);
  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');
  const toaster = useToaster();
  const load = useCallback(async () => {
    const json = await (await fetch('/integrations/list')).json();
    const all: any[] = Array.isArray(json?.integrations) ? json.integrations : [];
    return all
      .filter((f: any) => !(f.identifier === 'x' && disableXAnalytics))
      .filter((f: any) =>
        allowedIntegrations.includes(f.identifier) || f.identifier.endsWith('-late')
      );
  }, [disableXAnalytics]);
  const { data, isLoading } = useSWR('analytics-list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: true,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data,
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);
  const currentIntegration = useMemo(() => {
    return sortedIntegrations[current];
  }, [current, sortedIntegrations]);

  const enabledPresetDays = useMemo(() => {
    if (!currentIntegration) {
      return [];
    }

    const baseId = (() => {
      const id = currentIntegration.identifier;
      if (!id.endsWith('-late')) return id;
      const stripped = id.slice(0, -5);
      return stripped === 'linkedin' ? 'linkedin-page' : stripped;
    })();
    const arr: number[] = [];
    if (
      [
        'facebook',
        'instagram',
        'instagram-standalone',
        'linkedin-page',
        'pinterest',
        'youtube',
        'threads',
        'gmb',
        'x',
        'tiktok',
      ].indexOf(baseId) !== -1
    ) {
      arr.push(7);
    }
    if (
      [
        'facebook',
        'instagram',
        'instagram-standalone',
        'linkedin-page',
        'pinterest',
        'youtube',
        'threads',
        'gmb',
        'x',
        'tiktok',
      ].indexOf(baseId) !== -1
    ) {
      arr.push(30);
    }
    if (
      ['facebook', 'linkedin-page', 'pinterest', 'youtube', 'x', 'gmb'].indexOf(baseId) !== -1
    ) {
      arr.push(90);
    }
    return arr;
  }, [currentIntegration]);

  const visibleTabs = useMemo(() => {
    if (!currentIntegration) return ['engagement', 'overview', 'followers'] as TabId[];
    const id = currentIntegration.identifier;
    const base = id.endsWith('-late') ? id.slice(0, -5) : id;
    const tabs: TabId[] = ['engagement', 'overview', 'followers', 'best-time', 'performance'];
    if (base.startsWith('instagram') || base.startsWith('youtube')) {
      tabs.push('audience');
    }
    if (
      base.startsWith('instagram') ||
      base.startsWith('facebook') ||
      base.startsWith('linkedin') ||
      base.startsWith('tiktok') ||
      base.startsWith('youtube')
    ) {
      tabs.push('account-insights');
    }
    if (base === 'gmb' || base === 'googlebusiness') {
      tabs.push('gbp');
    }
    return tabs;
  }, [currentIntegration]);

  const tabLabels: Record<TabId, string> = {
    engagement: 'Engagement',
    overview: 'Overview',
    followers: 'Followers',
    audience: 'Audience',
    'best-time': 'Best Time',
    performance: 'Performance',
    'account-insights': 'Account Insights',
    gbp: 'GBP',
  };

  const renderTabPanel = () => {
    if (!currentIntegration) return null;
    if (activeTab === 'engagement') {
      return (
        <EngagementPanel
          key={`${currentIntegration.id}-${dateRange.fromDate}-${dateRange.toDate}`}
          integration={currentIntegration}
          fromDate={dateRange.fromDate}
          toDate={dateRange.toDate}
        />
      );
    }
    if (activeTab === 'overview') {
      return (
        <DailyOverviewPanel
          integration={currentIntegration}
          fromDate={dateRange.fromDate}
          toDate={dateRange.toDate}
        />
      );
    }
    if (activeTab === 'followers') {
      return <FollowersPanel integration={currentIntegration} />;
    }
    if (activeTab === 'audience') {
      return <DemographicsPanel integration={currentIntegration} />;
    }
    if (activeTab === 'best-time') {
      return <BestTimePanel integration={currentIntegration} />;
    }
    if (activeTab === 'performance') {
      return <PerformancePanel integration={currentIntegration} />;
    }
    if (activeTab === 'account-insights') {
      return (
        <AccountInsightsPanel
          integration={currentIntegration}
          fromDate={dateRange.fromDate}
          toDate={dateRange.toDate}
        />
      );
    }
    if (activeTab === 'gbp') {
      return (
        <GBPPanel
          integration={currentIntegration}
          fromDate={dateRange.fromDate}
          toDate={dateRange.toDate}
        />
      );
    }
    return null;
  };

  if (!data || isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  if (!sortedIntegrations.length) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-col gap-[15px] transition-all flex-1 justify-center items-center text-center">
        <div>
          <img src="/peoplemarketplace.svg" />
        </div>
        <div className="text-[48px]">
          {t('can_t_show_analytics_yet', "Can't show analytics yet")}
          <br />
          {t(
            'you_have_to_add_social_media_channels',
            'You have to add Social Media channels'
          )}
        </div>
        <div className="text-[20px]">
          {t('supported', 'Supported:')}
          {allowedIntegrations.map((p) => capitalize(p)).join(', ')}
        </div>
        <Button onClick={() => router.push('/launches')}>
          {t(
            'go_to_the_calendar_to_add_channels',
            'Go to the calendar to add channels'
          )}
        </Button>
      </div>
    );
  }
  return (
    <>
      <div
        className={clsx(
          'bg-newBgColorInner p-[20px] flex flex-col gap-[15px] transition-all',
          collapseMenu === '1' ? 'group sidebar w-[100px]' : 'w-[260px]'
        )}
      >
        <div className="flex gap-[12px] flex-col">
          <div className="flex items-center">
            <h2 className="group-[.sidebar]:hidden flex-1 text-[20px] font-[500]">
              {t('channels')}
            </h2>
            <div
              onClick={() => setCollapseMenu(collapseMenu === '1' ? '0' : '1')}
              className="group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-[6px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer select-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="7"
                height="13"
                viewBox="0 0 7 13"
                fill="none"
              >
                <path
                  d="M6 11.5L1 6.5L6 1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          {sortedIntegrations.map((integration, index) => (
            <div
              key={integration.id}
              onClick={() => {
                if (integration.refreshNeeded) {
                  toaster.show(
                    'Please refresh the integration from the calendar',
                    'warning'
                  );
                  return;
                }
                setRefresh(true);
                setTimeout(() => {
                  setRefresh(false);
                }, 10);
                setCurrent(index);
              }}
              className={clsx(
                'flex gap-[12px] items-center group/profile justify-center hover:bg-boxHover rounded-e-[8px]',
                currentIntegration.id !== integration.id &&
                  'opacity-20 hover:opacity-100 cursor-pointer'
              )}
            >
              <div
                className={clsx(
                  'relative rounded-full flex justify-center items-center gap-[6px]',
                  integration.disabled && 'opacity-50'
                )}
              >
                {(integration.inBetweenSteps || integration.refreshNeeded) && (
                  <div className="absolute start-0 top-0 w-[39px] h-[46px] cursor-pointer">
                    <div className="bg-red-500 w-[15px] h-[15px] rounded-full start-0 -top-[5px] absolute z-[200] text-[10px] flex justify-center items-center">
                      !
                    </div>
                    <div className="bg-primary/60 w-[39px] h-[46px] start-0 top-0 absolute rounded-full z-[199]" />
                  </div>
                )}
                <div className="h-full w-[4px] -ms-[12px] rounded-s-[3px] opacity-0 group-hover/profile:opacity-100 transition-opacity">
                  <SVGLine />
                </div>
                <ImageWithFallback
                  fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                  src={integration.picture}
                  className="rounded-[8px]"
                  alt={integration.identifier}
                  width={36}
                  height={36}
                />
                <SafeImage
                  src={`/icons/platforms/${integration.identifier}.png`}
                  className="rounded-[8px] absolute z-10 bottom-[5px] -end-[5px] border border-fifth"
                  alt={integration.identifier}
                  width={18.41}
                  height={18.41}
                />
              </div>
              <div
                className={clsx(
                  'flex-1 whitespace-nowrap text-ellipsis overflow-hidden group-[.sidebar]:hidden',
                  integration.disabled && 'opacity-50'
                )}
              >
                {integration.name}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">
        {!!enabledPresetDays.length && (
          <div className="flex-1 flex flex-col gap-[14px]">
            <div className="flex flex-col gap-[10px]">
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                allowedPresetDays={enabledPresetDays}
              />
              <div className="flex flex-wrap gap-[8px]">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={[
                      'px-[10px] py-[6px] rounded-[8px] text-[13px] border transition-colors',
                      tab === activeTab
                        ? 'bg-[#612bd3] text-white border-[#612bd3]'
                        : 'bg-newTableHeader border-newTableBorder hover:border-[#612bd3]/40',
                    ].join(' ')}
                  >
                    {tabLabels[tab]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              {!!currentIntegration && !refresh && renderTabPanel()}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
