'use client';

import { useEffect, useId, useState } from 'react';
import { normalizeDimensionInput } from '@/lib/fit';

interface Props {
  /** 화면에 보이는 이름 — placeholder 로 대체하지 않는다 */
  label: string;
  /** 축 약자 (W / D / H) */
  axis: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}

/**
 * 히어로에서 쓰는 치수 직접 입력칸.
 *
 * 입력 도중에는 아무것도 고치지 않는다. 지웠다가 다시 치는 흔한 동작을
 * 막지 않기 위해서다. blur 나 Enter 에서만 범위 안으로 끌어당긴다.
 */
export default function DimensionNumberInput({
  label,
  axis,
  value,
  min,
  max,
  onChange,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));

  // 슬라이더·프리셋 등 바깥에서 값이 바뀌면 입력칸도 따라간다
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const next = normalizeDimensionInput(raw, min, max);
    if (next === null) {
      // 빈칸이나 숫자가 아니면 직전 값으로 되돌린다
      setDraft(String(value));
      return;
    }
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className="flex-1">
      <label
        htmlFor={id}
        className="block text-xs font-bold text-slate-600 sm:text-[13px]"
      >
        {label}{' '}
        <span className="font-extrabold text-brand-600">{axis}</span>
      </label>

      <div className="mt-1.5 flex items-baseline rounded-xl border border-slate-300 bg-white px-2 py-2 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200 sm:px-2.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
            }
          }}
          className="dim-number w-full min-w-0 bg-transparent text-right text-lg font-extrabold tabular-nums text-slate-900 outline-none sm:text-xl"
        />
        <span
          className="ml-1 shrink-0 text-xs font-bold text-slate-400 sm:text-sm"
          aria-hidden="true"
        >
          cm
        </span>
      </div>
    </div>
  );
}
