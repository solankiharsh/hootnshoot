// @ts-nocheck
'use client';
import React from 'react';
import { InputGroup, Button } from '@blueprintjs/core';
import { Search, Plus } from '@blueprintjs/icons';
import { ImagesGrid } from './images-grid';
import { useInfiniteAPI } from '../utils/use-api';
import { t as s } from '../utils/l10n';
import { selectImage } from './select-image';
import { StoreType } from '../model/store';
import { URLS } from '../utils/api';

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

export const PhotosPanel = ({ store }: { store: StoreType }) => {
  const [query, setQuery] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const getMediaAPI = ({ page, query: q }: any) => {
    if (URLS.mediaList) {
      return URLS.mediaList({ page, query: q });
    }
    return '';
  };

  const { setQuery: setApiQuery, loadMore, isReachingEnd, data, isLoading, error } = useInfiniteAPI({
    defaultQuery: '',
    getAPI: getMediaAPI,
    getSize: (page: any) => page.pages,
    fetchFunc: authFetcher,
  });

  React.useEffect(() => {
    setApiQuery(query);
  }, [query]);

  const handleUpload = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      const authCookie =
        typeof document !== 'undefined'
          ? document.cookie
              .split(';')
              .find((p) => p.includes('auth='))
              ?.split('=')[1]
          : undefined;

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const backendBase = URLS.mediaList?.({ page: 1, query: '' })?.split('/media')[0] || '';
        if (!backendBase) continue;
        const res = await fetch(`${backendBase}/media/upload-simple`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(authCookie ? { auth: authCookie } : {}),
          },
          body: formData,
        });
        if (!res.ok) continue;
        const media = await res.json();
        if (media && media.path) {
          selectImage({
            src: media.path,
            store,
            droppedPos: null,
            targetElement: null,
          });
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [store]);

  return React.createElement(
    'div',
    { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    React.createElement(
      'div',
      { style: { display: 'flex', gap: '8px', marginBottom: '12px' } },
      React.createElement(InputGroup, {
        leftIcon: React.createElement(Search, null),
        placeholder: s('sidePanel.searchPlaceholder'),
        onChange: (e: any) => { setQuery(e.target.value); },
        type: 'search',
        style: { flex: 1 },
      }),
      React.createElement(
        'label',
        { htmlFor: 'media-upload-input' },
        React.createElement(
          Button,
          {
            icon: React.createElement(Plus, null),
            loading: isUploading,
            onClick: () => { inputRef.current?.click(); },
            style: { minWidth: '36px', padding: '0 8px' },
          },
        ),
        React.createElement('input', {
          id: 'media-upload-input',
          type: 'file',
          ref: inputRef,
          style: { display: 'none' },
          onChange: handleUpload,
          multiple: true,
          accept: 'image/*',
        })
      )
    ),
    React.createElement(ImagesGrid, {
      images: data?.map((d: any) => d.results).flat().filter(Boolean).filter((f: any) => f.path?.indexOf('mp4') === -1),
      getPreview: (item: any) => item.thumbnail || item.path,
      onSelect: async (item: any, pos: any, el: any) => {
        const src = item.thumbnail || item.path;
        selectImage({ src, store, droppedPos: pos, targetElement: el });
      },
      isLoading,
      error,
      loadMore: !isReachingEnd && loadMore,
    })
  );
};
