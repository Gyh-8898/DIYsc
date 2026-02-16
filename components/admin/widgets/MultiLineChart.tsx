import React, { useState } from 'react';

function toNum(v: unknown, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function pickAxisIndices(total: number) {
  if (total <= 0) return [] as number[];
  if (total <= 6) return Array.from({ length: total }, (_, i) => i);
  const points = [0, Math.round((total - 1) * 0.25), Math.round((total - 1) * 0.5), Math.round((total - 1) * 0.75), total - 1];
  return Array.from(new Set(points)).sort((a, b) => a - b);
}

export default function MultiLineChart({
  labels,
  series,
  height = 250
}: {
  labels: string[];
  series: Array<{ name: string; color: string; data: number[]; money?: boolean }>;
  height?: number;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.data), 1);
  const axisIdx = pickAxisIndices(labels.length);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const pathFor = (data: number[]) =>
    data
      .map((v, idx) => `${(idx / Math.max(data.length - 1, 1)) * 100},${100 - (toNum(v, 0) / max) * 100}`)
      .join(' ');

  const indexToXPct = (idx: number) => (idx / Math.max(labels.length - 1, 1)) * 100;
  const valueToYPct = (v: number) => 100 - (toNum(v, 0) / max) * 100;

  return (
    <div className="h-full">
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <div key={s.name} className="inline-flex items-center gap-1 text-gray-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 100 100"
          className="w-full rounded border border-gray-100 bg-white"
          style={{ height }}
          onMouseMove={(e) => {
            if (labels.length === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const idx = clamp(Math.round((x / rect.width) * Math.max(labels.length - 1, 1)), 0, labels.length - 1);
            setHoverIdx(idx);
            setHoverPos({ x, y });
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <line x1="0" y1="100" x2="100" y2="100" stroke="#e5e7eb" strokeWidth="1" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="#f3f4f6" strokeWidth="0.8" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#f3f4f6" strokeWidth="0.8" />
          <line x1="0" y1="25" x2="100" y2="25" stroke="#f3f4f6" strokeWidth="0.8" />

          {series.map((s) => (
            <polyline
              key={s.name}
              points={pathFor(s.data)}
              fill="none"
              stroke={s.color}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {hoverIdx !== null ? (
            <>
              <line
                x1={indexToXPct(hoverIdx)}
                y1="0"
                x2={indexToXPct(hoverIdx)}
                y2="100"
                stroke="#94a3b8"
                strokeWidth="0.7"
                strokeDasharray="2 2"
              />
              {series.map((s) => {
                const value = toNum(s.data[hoverIdx], 0);
                return <circle key={`dot_${s.name}`} cx={indexToXPct(hoverIdx)} cy={valueToYPct(value)} r="1.6" fill="#fff" stroke={s.color} strokeWidth="1" />;
              })}
            </>
          ) : null}
        </svg>

        {hoverIdx !== null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[150px] rounded border border-gray-200 bg-white p-2 text-xs shadow-lg"
            style={{ left: `${hoverPos.x + 10}px`, top: `${Math.max(8, hoverPos.y - 30)}px` }}
          >
            <div className="mb-1 font-semibold text-gray-700">{labels[hoverIdx] || '-'}</div>
            <div className="space-y-1">
              {series.map((s) => {
                const value = toNum(s.data[hoverIdx], 0);
                return (
                  <div key={`tip_${s.name}`} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-semibold text-gray-800">{s.money ? `\u00a5${value.toFixed(2)}` : value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-gray-400">
        {axisIdx.map((idx) => (
          <span key={idx}>{labels[idx] || '-'}</span>
        ))}
      </div>
    </div>
  );
}
