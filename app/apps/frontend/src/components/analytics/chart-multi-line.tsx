'use client';

import { FC, useEffect, useMemo, useRef } from 'react';
import DrawChart from 'chart.js/auto';
import useCookie from 'react-use-cookie';

type Dataset = {
  label: string;
  values: number[];
};

const PALETTE = ['#612bd3', '#32d583', '#1d9bf0', '#f59e0b', '#ef4444'];

export const ChartMultiLine: FC<{
  labels: string[];
  datasets: Dataset[];
}> = ({ labels, datasets }) => {
  const [mode] = useCookie('mode', 'dark');
  const ref = useRef<HTMLCanvasElement | null>(null);
  const chart = useRef<DrawChart | null>(null);

  const colors = useMemo(
    () => ({
      grid: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      ticks: mode === 'dark' ? '#d0d0d0' : '#444',
    }),
    [mode]
  );

  useEffect(() => {
    if (!ref.current) return;
    chart.current?.destroy();
    chart.current = new DrawChart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((set, idx) => ({
          label: set.label,
          data: set.values,
          borderColor: PALETTE[idx % PALETTE.length],
          backgroundColor: PALETTE[idx % PALETTE.length],
          tension: 0.35,
          fill: false,
          pointRadius: 2,
        })),
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: colors.grid },
            ticks: { color: colors.ticks },
          },
          x: {
            grid: { display: false },
            ticks: { color: colors.ticks },
          },
        },
        plugins: {
          legend: {
            display: true,
            labels: { color: colors.ticks, usePointStyle: true },
          },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [labels, datasets, colors]);

  return <canvas ref={ref} className="w-full h-full" />;
};
