'use client';

import { FC, Fragment } from 'react';

type HeatPoint = {
  day: string;
  hour: number;
  score: number;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ChartHeatmap: FC<{
  points: HeatPoint[];
}> = ({ points }) => {
  const max = Math.max(1, ...points.map((p) => p.score));
  const lookup = new Map(points.map((p) => [`${p.day}-${p.hour}`, p.score]));

  return (
    <div className="overflow-auto">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: '80px repeat(24, 1fr)' }}>
        <div />
        {Array.from({ length: 24 }).map((_, hour) => (
          <div key={`h-${hour}`} className="text-[10px] opacity-70 text-center py-[3px]">
            {hour}
          </div>
        ))}

        {DAYS.map((day) => (
          <Fragment key={day}>
            <div key={`${day}-label`} className="text-[12px] py-[4px]">
              {day}
            </div>
            {Array.from({ length: 24 }).map((_, hour) => {
              const score = lookup.get(`${day}-${hour}`) || 0;
              const alpha = score === 0 ? 0.06 : 0.12 + (score / max) * 0.7;
              return (
                <div
                  key={`${day}-${hour}`}
                  className="h-[20px] border border-black/5"
                  style={{ backgroundColor: `rgba(97,43,211,${alpha})` }}
                  title={`${day} ${hour}:00 - ${score.toFixed(1)}`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
};
