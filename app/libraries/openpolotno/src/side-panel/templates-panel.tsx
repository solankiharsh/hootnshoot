// @ts-nocheck
'use client';
import React from 'react';
import { observer } from 'mobx-react-lite';
import { Switch, Alignment, InputGroup } from '@blueprintjs/core';
import { nanoid } from 'nanoid';
import { forEveryChild } from '../model/group-model';
import { Search } from '@blueprintjs/icons';
import { t as s } from '../utils/l10n';
import { ImagesGrid } from './images-grid';
import { templateList } from '../utils/api';
import { useInfiniteAPI, fetcher } from '../utils/use-api';
import { getAPI, URLS } from '../utils/api';
import { StoreType } from '../model/store';

const useUpdateEffect = (fn: () => void, deps: any[]) => {
  const isFirstRun = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRun.current) { isFirstRun.current = false; return; }
    fn();
  }, deps);
};

const authFetcher = (url: string) => {
  const authCookie =
    typeof document !== 'undefined'
      ? document.cookie
          .split(';')
          .find((p) => p.includes('auth='))
          ?.split('=')[1]
      : undefined;

  return fetch(url, {
    credentials: 'include',
    headers: {
      ...(authCookie ? { auth: authCookie } : {}),
      Accept: 'application/json',
    },
    cache: 'no-store',
  }).then((r) => r.json());
};

const flattenTemplatePages = (data: any[] | undefined) =>
  data
    ?.map((d: any) => {
      if (d.results) return d.results;
      if (d.items) return d.items;
      return d;
    })
    .flat() || [];

const resolvePreviewUrl = (preview: string | null | undefined) => {
  if (!preview) return '';
  if (preview.startsWith('http://') || preview.startsWith('https://')) return preview;
  const base =
    typeof window !== 'undefined' && (window as any).vars?.frontEndUrl
      ? String((window as any).vars.frontEndUrl).replace(/\/$/, '')
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
  return preview.startsWith('/') ? `${base}${preview}` : `${base}/${preview}`;
};

const templatePageCount = (page: any) => {
  if (!page) return 1;
  const n = page.pages ?? page.totalPages ?? page.total_pages;
  if (n === 0) return 1;
  return n ?? 1;
};

const TemplatesList = observer(({ sizeQuery, query, store }: { sizeQuery: string; query: string; store: StoreType }) => {
  const userListUrl = URLS.userTemplateList?.({ page: 1, query: '' });
  const hasUserTemplates = Boolean(userListUrl);
  const [userImages, setUserImages] = React.useState<any[]>([]);

  const stock = useInfiniteAPI({
    getAPI: ({ page, query: q }: any) => templateList({ page, query: q, sizeQuery }),
    getSize: templatePageCount,
    fetchFunc: fetcher,
  });

  const { setQuery, loadMore, hasMore, isLoading, reset, error } = stock;

  React.useEffect(() => {
    if (!hasUserTemplates) {
      setUserImages([]);
      return;
    }
    const url = URLS.userTemplateList?.({ page: 1, query });
    if (!url) return;
    authFetcher(url)
      .then((d) => setUserImages(d?.results || []))
      .catch(() => setUserImages([]));
  }, [query, hasUserTemplates, sizeQuery]);

  useUpdateEffect(() => { reset(); }, [sizeQuery]);
  useUpdateEffect(() => { setQuery(query); }, [query]);

  const images = [...userImages, ...flattenTemplatePages(stock.data)];

  return React.createElement(ImagesGrid, {
    images,
    getPreview: (item: any) => resolvePreviewUrl(item.preview),
    isLoading,
    onSelect: async (item: any) => {
      if (item.json && typeof item.json === 'string' && !item.json.startsWith('http')) {
        try {
          const json = JSON.parse(item.json);
          if (store.pages.length <= 1) {
            store.loadJSON(json, true);
          } else {
            const current = JSON.parse(JSON.stringify(store.toJSON()));
            if (current.width !== json.width || current.height !== json.height) {
              json.pages.forEach((p: any) => {
                p.width = p.width || json.width;
                p.height = p.height || json.height;
              });
            }
            forEveryChild({ children: json.pages }, (el: any) => { el.id = nanoid(10); });
            const idx = store.pages.indexOf(store.activePage);
            current.pages.splice(idx, 1, ...json.pages);
            store.loadJSON(current, true);
          }
          return;
        } catch (e) {
          // fall through to template fetch
        }
      }
      const res = await fetch(item.json);
      const json = await res.json();
      if (store.pages.length <= 1) {
        store.loadJSON(json, true);
      } else {
        const current = JSON.parse(JSON.stringify(store.toJSON()));
        if (current.width !== json.width || current.height !== json.height) {
          json.pages.forEach((p: any) => {
            p.width = p.width || json.width;
            p.height = p.height || json.height;
          });
        }
        forEveryChild({ children: json.pages }, (el: any) => { el.id = nanoid(10); });
        const idx = store.pages.indexOf(store.activePage);
        current.pages.splice(idx, 1, ...json.pages);
        store.loadJSON(current, true);
      }
    },
    loadMore: hasMore && loadMore,
    error: error && !images.length && !isLoading ? error : undefined,
  });
});

export const TemplatesPanel = observer(({ store }: { store: StoreType }) => {
  const [sameSize, setSameSize] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const sizeQuery = sameSize ? `${store.width}x${store.height}` : 'all';

  return React.createElement(
    'div',
    { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    React.createElement(InputGroup, {
      leftIcon: React.createElement(Search, null),
      placeholder: s('sidePanel.searchPlaceholder'),
      type: 'search',
      onChange: (e: any) => { setQuery(e.target.value); },
      style: { marginBottom: '20px' },
    }),
    React.createElement(
      Switch,
      {
        checked: sameSize,
        onChange: (e: any) => { setSameSize(e.target.checked); },
        alignIndicator: Alignment.RIGHT,
        style: { marginTop: '8px', marginBottom: '25px' },
      },
      s('sidePanel.searchTemplatesWithSameSize'), ' '
    ),
    React.createElement(TemplatesList, { store, sizeQuery: 'size=' + sizeQuery, query })
  );
});
