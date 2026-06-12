'use client';

import React, { useState, useMemo, useCallback, FC } from 'react';
import { observer } from 'mobx-react-lite';
import useSWR from 'swr';
import clsx from 'clsx';
import { useDebounce } from 'use-debounce';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SearchIcon, PlusIcon } from '@gitroom/frontend/components/ui/icons';
import { SectionTab } from 'openpolotno/side-panel';
import { fitAndCenterOnPage } from 'openpolotno/utils/image';

interface BrandAsset {
  id: string;
  name: string;
  path: string;
  url: string;
  folder: string;
  size: number;
}

const AssetsTabIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const BrandAssetsPanel: FC<{ store: any }> = observer(({ store }) => {
  const t = useT();
  const fetch = useFetch();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [unreachableIds, setUnreachableIds] = useState<Set<string>>(() => new Set());

  const markUnreachable = useCallback((id: string) => {
    setUnreachableIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const { data: assets, isLoading, error } = useSWR(
    '/supabase/brand-assets',
    async (url: string) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch assets');
        return res.json();
      } catch (err) {
        console.error('Error fetching brand assets:', err);
        throw err;
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  );

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    return assets.filter(
      (asset: BrandAsset) =>
        !unreachableIds.has(asset.id) &&
        (asset.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          asset.folder.toLowerCase().includes(debouncedSearch.toLowerCase()))
    );
  }, [assets, debouncedSearch, unreachableIds]);

  const groupedAssets = useMemo(() => {
    const grouped: { [key: string]: BrandAsset[] } = {};
    filteredAssets.forEach((asset: BrandAsset) => {
      if (!grouped[asset.folder]) {
        grouped[asset.folder] = [];
      }
      grouped[asset.folder].push(asset);
    });
    return grouped;
  }, [filteredAssets]);

  const loadImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = url;
    });

  const addAssetToDesign = async (asset: BrandAsset) => {
    try {
      const img = await loadImage(asset.url);
      const placement = fitAndCenterOnPage(
        store,
        img.naturalWidth || 200,
        img.naturalHeight || 200
      );

      store.activePage?.addElement({
        type: 'image',
        src: asset.url,
        ...placement,
      });
    } catch (err) {
      markUnreachable(asset.id);
      console.warn('[BrandAssets] Could not load asset:', asset.path, err);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-[12px] bg-white">
        <div className="text-black/60 text-[12px] text-center">
          {t('error_loading_assets', 'Error loading brand assets')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white text-black">
      <div className="px-[12px] pt-[12px] pb-[8px] bg-white">
        <div className="relative">
          <SearchIcon className="absolute left-[10px] top-[50%] -translate-y-[50%] w-[14px] h-[14px] text-black/40 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_assets', 'Search assets...')}
            className="w-full h-[32px] pl-[30px] pr-[10px] rounded-[6px] bg-white border border-black/10 text-[11px] outline-none focus:border-black/30 text-black placeholder:text-black/40 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar scrollbar-thumb-black/20 scrollbar-track-transparent px-[12px] pb-[12px] bg-white">
        {isLoading ? (
          <div className="flex justify-center items-center h-[120px]">
            <LoadingComponent />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex justify-center items-center h-[120px] text-black/50 text-[11px]">
            {search
              ? t('no_matching_assets', 'No matching assets')
              : t('no_assets', 'No assets found')}
          </div>
        ) : (
          <div className="space-y-[14px]">
            {Object.entries(groupedAssets)
              .filter(([, folderAssets]) => folderAssets.length > 0)
              .map(([folder, folderAssets]) => (
              <div key={folder}>
                <div className="flex items-center gap-[6px] mb-[8px]">
                  <span className="text-[9px] font-[700] text-black/40 uppercase tracking-wider flex-shrink-0">
                    {folder === 'root' ? 'Root' : folder.replace(/\//g, ' / ')}
                  </span>
                  <div className="flex-1 h-[1px] bg-black/10" />
                </div>
                <div className="grid grid-cols-3 gap-[6px]">
                  {folderAssets.map((asset: BrandAsset) => (
                    <button
                      key={asset.id}
                      onClick={() => addAssetToDesign(asset)}
                      className={clsx(
                        'relative group overflow-hidden rounded-[6px]',
                        'bg-white border border-black/10',
                        'hover:border-black/30 transition-all duration-150',
                        'aspect-square flex-shrink-0'
                      )}
                      title={asset.name}
                      type="button"
                    >
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                        onError={() => markUnreachable(asset.id)}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-150 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <PlusIcon className="w-[14px] h-[14px] text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export const BrandAssetsSection = {
  name: 'brand-assets',
  Tab: (props: any) => (
    <SectionTab name="" {...props}>
      <div className="flex flex-col items-center gap-[2px]">
        <AssetsTabIcon />
        <span className="text-[10px] font-[600] leading-tight">Assets</span>
      </div>
    </SectionTab>
  ),
  Panel: BrandAssetsPanel,
};
