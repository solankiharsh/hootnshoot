'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { PolontoMediaPicker } from '@gitroom/frontend/components/launches/polonto/polonto.media.picker';
import {
  AIBackBar,
  AIErrorBanner,
  ImageCompareFrame,
  PrimaryAction,
} from '@gitroom/frontend/components/launches/polonto/polonto.ai.shared';
import { fitAndCenterOnPage } from 'openpolotno/utils/image';

export function AIEraseModal({ store, onClose }: { store: any; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(true);
  const fetch = useFetch();

  useEffect(() => {
    const selected = store?.activePage?.children?.find(
      (el: any) => el.type === 'image' && !el.contentEditable
    );
    if (selected?.src) {
      setSourceImage(selected.src);
      setShowUploader(false);
    }
  }, [store]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(reader.result as string);
      setShowUploader(false);
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (!sourceImage || !canvasRef.current || !maskCanvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const container = containerRef.current;
      const maxW = container ? container.clientWidth - 16 : 500;
      const maxH = 360;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      setCanvasDims({ w, h });

      canvasRef.current!.width = w;
      canvasRef.current!.height = h;
      maskCanvasRef.current!.width = w;
      maskCanvasRef.current!.height = h;

      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const maskCtx = maskCanvasRef.current!.getContext('2d')!;
      maskCtx.fillStyle = '#000000';
      maskCtx.fillRect(0, 0, w, h);
    };
    img.src = sourceImage;
  }, [sourceImage]);

  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const drawLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      if (!canvasRef.current || !maskCanvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 68, 79, 0.45)';
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      const maskCtx = maskCanvasRef.current.getContext('2d')!;
      maskCtx.strokeStyle = '#ffffff';
      maskCtx.lineWidth = brushSize;
      maskCtx.lineCap = 'round';
      maskCtx.beginPath();
      maskCtx.moveTo(from.x, from.y);
      maskCtx.lineTo(to.x, to.y);
      maskCtx.stroke();
    },
    [brushSize]
  );

  const drawBrush = useCallback(
    (x: number, y: number) => {
      if (!canvasRef.current || !maskCanvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.fillStyle = 'rgba(255, 68, 79, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      const maskCtx = maskCanvasRef.current.getContext('2d')!;
      maskCtx.fillStyle = '#ffffff';
      maskCtx.beginPath();
      maskCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      maskCtx.fill();
    },
    [brushSize]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDrawing(true);
      const pos = getCanvasPos(e);
      lastPosRef.current = pos;
      drawBrush(pos.x, pos.y);
    },
    [getCanvasPos, drawBrush]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const pos = getCanvasPos(e);
      if (lastPosRef.current) drawLine(lastPosRef.current, pos);
      lastPosRef.current = pos;
    },
    [isDrawing, getCanvasPos, drawLine]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    lastPosRef.current = null;
  }, []);

  const clearMask = useCallback(() => {
    if (!canvasRef.current || !maskCanvasRef.current || !imgRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgRef.current, 0, 0, w, h);
    const maskCtx = maskCanvasRef.current.getContext('2d')!;
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, w, h);
  }, []);

  const handleErase = useCallback(async () => {
    if (!maskCanvasRef.current || !sourceImage) return;
    setIsProcessing(true);
    setError('');
    setResultUrl(null);
    try {
      const maskDataUrl = maskCanvasRef.current.toDataURL('image/png');
      const res = await fetch('/media/erase-image', {
        method: 'POST',
        body: JSON.stringify({ image: sourceImage, mask: maskDataUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || 'Erase failed');
      }
      const { base64 } = await res.json();
      if (!base64) throw new Error('No image returned');
      setResultUrl(`data:image/png;base64,${base64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erase failed');
    } finally {
      setIsProcessing(false);
    }
  }, [sourceImage, fetch]);

  const handleApply = useCallback(() => {
    if (!resultUrl) return;
    const placement = fitAndCenterOnPage(
      store,
      canvasDims.w,
      canvasDims.h
    );
    store.activePage?.addElement({
      type: 'image',
      src: resultUrl,
      ...placement,
    });
    onClose();
  }, [resultUrl, canvasDims, store, onClose]);

  if (showUploader) {
    return (
      <div className="flex h-full flex-col overflow-y-auto px-1 pb-4">
        <AIBackBar label="Erase objects" onBack={onClose} />
        <p className="text-[12px] text-gray-500 mb-3 leading-snug">
          Paint over objects to remove. Choose a source image first.
        </p>
        <PolontoMediaPicker
          onSelect={(dataUrl) => {
            setSourceImage(dataUrl);
            setShowUploader(false);
          }}
        />
        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[11px] text-gray-400 uppercase tracking-wide">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <label
          htmlFor="erase-upload"
          className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-[13px] font-medium text-gray-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors"
        >
          Upload from device
        </label>
        <input
          id="erase-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden px-1 pb-2">
      <AIBackBar label="Erase objects" onBack={onClose} />

      <div className="flex flex-wrap items-center gap-2 mb-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
        <span className="text-[11px] font-medium text-gray-500">Brush</span>
        <button
          type="button"
          onClick={() => setBrushSize(Math.max(5, brushSize - 5))}
          className="h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
          aria-label="Smaller brush"
        >
          −
        </button>
        <span className="min-w-[28px] text-center text-[12px] font-semibold text-gray-800">
          {brushSize}
        </span>
        <button
          type="button"
          onClick={() => setBrushSize(Math.min(100, brushSize + 5))}
          className="h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
          aria-label="Larger brush"
        >
          +
        </button>
        <button
          type="button"
          onClick={clearMask}
          className="ml-auto rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
        >
          Clear mask
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex flex-1 min-h-[200px] items-center justify-center overflow-auto rounded-lg border border-gray-200 bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%)] bg-[length:12px_12px] p-2"
      >
        {resultUrl ? (
          <div className="flex gap-2 w-full justify-center flex-wrap">
            <ImageCompareFrame label="Before" src={sourceImage} />
            <ImageCompareFrame label="After" src={resultUrl} />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="max-w-full rounded-md shadow-sm cursor-crosshair touch-none"
            style={{ maxHeight: 360 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        )}
      </div>

      <canvas ref={maskCanvasRef} className="hidden" aria-hidden />

      {error && <AIErrorBanner message={error} />}

      <div className="flex gap-2 mt-2 pt-2 [&>button]:flex-1">
        {!resultUrl ? (
          <PrimaryAction onClick={handleErase} loading={isProcessing}>
            {isProcessing ? 'Removing…' : 'Erase selected area'}
          </PrimaryAction>
        ) : (
          <>
            <PrimaryAction
              variant="secondary"
              onClick={() => {
                setResultUrl(null);
                clearMask();
              }}
            >
              Try again
            </PrimaryAction>
            <PrimaryAction variant="success" onClick={handleApply}>
              Apply to canvas
            </PrimaryAction>
          </>
        )}
      </div>
    </div>
  );
}
