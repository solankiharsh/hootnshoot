'use client';

import { useCallback, memo } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export async function srcToDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const res = await fetch(src, { credentials: 'include' });
  if (!res.ok) throw new Error('Could not load image');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

export function PolontoMediaPicker({
  onSelect,
}: {
  onSelect: (dataUrl: string) => void;
}) {
  const fetch = useFetch();
  const loadMedia = useCallback(async () => {
    return (await fetch('/media?page=1')).json();
  }, [fetch]);
  const { data, isLoading } = useSWR('polonto-ai-media-picker', loadMedia);

  const images = (data?.results || []).filter(
    (item: { path?: string }) =>
      item.path && !item.path.includes('.mp4') && !item.path.includes('video')
  );

  const handlePick = useCallback(
    async (path: string) => {
      try {
        onSelect(await srcToDataUrl(path));
      } catch {
        onSelect(path);
      }
    },
    [onSelect]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 mb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!images.length) {
    return (
      <p className="text-[12px] text-gray-500 mb-3 leading-snug rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center m-0">
        No images in your library yet. Upload one below.
      </p>
    );
  }

  return <MediaGrid images={images} onPick={handlePick} />;
}

const MediaGrid = memo(function MediaGrid({
  images,
  onPick,
}: {
  images: { id: string; path: string; thumbnail?: string }[];
  onPick: (path: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-3 max-h-[200px] overflow-y-auto pr-0.5">
      {images.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.path)}
          className="group relative aspect-square overflow-hidden rounded-lg border-2 border-transparent bg-gray-100 hover:border-violet-400 focus:outline-none focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-200 transition-colors"
        >
          <img
            src={item.thumbnail || item.path}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </button>
      ))}
    </div>
  );
});
