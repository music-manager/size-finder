'use client';

import { ArrowUpDown } from 'lucide-react';
import type { SortKey } from '@/lib/types';

interface Props {
  value: SortKey;
  onChange: (next: SortKey) => void;
}

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: '기본순' },
  { value: 'width', label: '폭 좁은 순' },
  { value: 'depth', label: '깊이 얕은 순' },
  { value: 'size', label: '작은 크기순' },
  { value: 'price', label: '낮은 가격순' },
];

export default function SortSelect({ value, onChange }: Props) {
  return (
    <div className="relative">
      <ArrowUpDown
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        aria-label="정렬 기준"
        className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
