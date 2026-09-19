'use client';

import { CATEGORIES } from '@/lib/categories';
import type { CategoryId } from '@/lib/types';

interface Props {
  value: CategoryId | 'all';
  counts: Record<string, number>;
  onChange: (next: CategoryId | 'all') => void;
}

export default function CategoryTabs({ value, counts, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="카테고리 선택"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {CATEGORIES.map((category) => {
        const active = value === category.id;
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(category.id)}
            className={[
              'flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition',
              active
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700',
            ].join(' ')}
          >
            <span aria-hidden="true">{category.emoji}</span>
            {category.label}
            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              {counts[category.id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
