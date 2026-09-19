'use client';

import { useEffect, useState } from 'react';

interface Props {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}

/** 슬라이더와 숫자 입력이 같은 값을 공유하는 최대 치수 컨트롤 */
export default function DimensionSlider({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: Props) {
  // 입력 중 "5" 같은 중간 상태를 곧바로 clamp 하면 타이핑이 막히므로
  // 텍스트 상태를 따로 두고 blur/Enter 시점에 확정한다.
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (!raw.trim() || Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
    setDraft(String(clamped));
    onChange(clamped);
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label
          htmlFor={`dim-${label}`}
          className="text-sm font-semibold text-slate-800"
        >
          {label}
          <span className="ml-1 text-xs font-normal text-slate-400">{hint}</span>
        </label>
        <div className="flex items-center gap-1">
          <input
            id={`dim-${label}-number`}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit((event.target as HTMLInputElement).value);
              }
            }}
            aria-label={`${label} 직접 입력`}
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm font-bold text-brand-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <span className="text-sm font-semibold text-slate-500">cm</span>
        </div>
      </div>

      <input
        id={`dim-${label}`}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={`${label} 슬라이더`}
        className="dim-slider mt-3"
        style={{
          background: `linear-gradient(to right, #1d69f0 ${percent}%, #e2e8f0 ${percent}%)`,
        }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{min}cm</span>
        <span>{max}cm</span>
      </div>
    </div>
  );
}
