'use client';

import { FC, useEffect, useRef } from 'react';
import DrawChart from 'chart.js/auto';

export const ChartDecay: FC<{
  labels: string[];
  values: number[];
}> = ({ labels, values }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const chart = useRef<DrawChart | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current?.destroy();
    chart.current = new DrawChart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Engagement %',
            data: values,
            borderColor: 'rgb(97, 43, 211)',
            backgroundColor: 'rgba(97, 43, 211, 0.22)',
            fill: true,
            tension: 0.35,
            pointRadius: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100 },
        },
      },
    });

    return () => chart.current?.destroy();
  }, [labels, values]);

  return <canvas ref={ref} className="w-full h-full" />;
};
