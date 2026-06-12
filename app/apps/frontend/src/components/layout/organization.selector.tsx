'use client';

import React, { FC, useCallback, useMemo } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import clsx from 'clsx';

export const OrganizationSelector: FC<{ asOpenSelect?: boolean }> = ({
  asOpenSelect,
}) => {
  const fetch = useFetch();
  const user = useUser();
  const load = useCallback(async () => {
    return await (await fetch('/user/organizations')).json();
  }, []);
  const { isLoading, data } = useSWR('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });

  const current = useMemo(() => {
    return data?.find((d: any) => d.id === user?.orgId);
  }, [data, user?.orgId]);

  const changeOrg = useCallback(
    (org: { name: string; id: string }) => async () => {
      await fetch('/user/change-org', {
        method: 'POST',
        body: JSON.stringify({ id: org.id }),
      });
      window.location.reload();
    },
    []
  );

  const displayName = useMemo(() => {
    if (user?.isPersonal) return 'Personal';
    return current?.name || user?.orgName || '';
  }, [current, user]);

  if (isLoading) return null;

  const hasMultipleOrgs = data?.length > 1;

  if (asOpenSelect) {
    return (
      <div className="bg-btnPrimary !flex !relative max-w-[500px] mx-auto py-[12px] px-[12px] flex-col gap-[8px]">
        <div className="font-[500] text-[13px] mb-[4px]">Select workspace</div>
        {data?.map((org: { name: string; id: string; isPersonal?: boolean }) => (
          <div
            key={org.id}
            onClick={changeOrg(org)}
            className="cursor-pointer px-[10px] py-[8px] rounded-[6px] hover:bg-white/10 text-[13px]"
          >
            {org.isPersonal ? 'Personal' : org.name}
            {org.id === user?.orgId && (
              <span className="ml-[8px] text-[11px] opacity-60">(current)</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="hover:text-newTextColor">
        <div
          className={clsx(
            'group text-[12px] relative flex items-center gap-[6px] cursor-pointer select-none',
            hasMultipleOrgs ? 'cursor-pointer' : 'cursor-default'
          )}
        >
          <div className="flex items-center gap-[6px]">
            {user?.isPersonal ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            )}
            <span className="font-[500] text-[13px] max-w-[120px] truncate">{displayName}</span>
            {hasMultipleOrgs && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 8L1 3h10L6 8z"/>
              </svg>
            )}
          </div>

          {hasMultipleOrgs && (
            <div className="hidden group-hover:flex absolute top-[calc(100%+4px)] end-0 bg-third border-tableBorder border rounded-[8px] overflow-hidden z-[50] flex-col min-w-[160px] shadow-lg">
              {data?.map((org: { name: string; id: string; isPersonal?: boolean }) => (
                <div
                  key={org.id}
                  onClick={changeOrg(org)}
                  className={clsx(
                    'px-[14px] py-[10px] text-[13px] cursor-pointer hover:bg-white/5 flex items-center gap-[8px]',
                    org.id === user?.orgId ? 'font-[600]' : ''
                  )}
                >
                  {org.isPersonal ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                  )}
                  {org.isPersonal ? 'Personal' : org.name}
                  {org.id === user?.orgId && (
                    <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="w-[1px] h-[20px] bg-blockSeparator" />
    </>
  );
};
