'use client';

import { CATEGORIES } from '@/lib/categories';
import type { TabId } from '@/lib/types';

interface Props {
  value: TabId;
  counts: Record<string, number>;
  onChange: (next: TabId) => void;
}

export default function CategoryTabs({ value, counts, onChange }: Props) {
  return (
    <div className="relative">
      <div
        role="tablist"
        aria-label="카테고리 선택"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:px-0"
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
              'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold transition',
              active
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700',
            ].join(' ')}
          >
            <span aria-hidden="true">{category.emoji}</span>
            {category.label}
            <span
              className={[
                'rounded-full px-1.5 text-[10px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              {counts[category.id] ?? 0}
            </span>
          </button>
        );
      })}
      </div>
      {/* 가로 스크롤이 더 남아 있음을 알리는 페이드 */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50 to-transparent" />
    </div>
  );
}
