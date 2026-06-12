'use client';

import { FC, useEffect, useMemo, useRef } from 'react';
import DrawChart from 'chart.js/auto';
import useCookie from 'react-use-cookie';

export const ChartBar: FC<{
  labels: string[];
  values: number[];
  label?: string;
}> = ({ labels, values, label = 'Value' }) => {
  const [mode] = useCookie('mode', 'dark');
  const ref = useRef<HTMLCanvasElement | null>(null);
  const chart = useRef<DrawChart | null>(null);

  const color = useMemo(
    () => ({
      border: 'rgb(97, 43, 211)',
      background: 'rgba(97, 43, 211, 0.25)',
      grid: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      ticks: mode === 'dark' ? '#d0d0d0' : '#444',
    }),
    [mode]
  );

  useEffect(() => {
    if (!ref.current) return;
    chart.current?.destroy();
    chart.current = new DrawChart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            borderColor: color.border,
            backgroundColor: color.background,
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: color.grid },
            ticks: { color: color.ticks },
          },
          x: {
            grid: { display: false },
            ticks: { color: color.ticks },
          },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [labels, values, label, color]);

  return <canvas ref={ref} className="w-full h-full" />;
};
