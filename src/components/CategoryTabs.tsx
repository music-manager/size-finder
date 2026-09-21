'use client';

import {
  Bed,
  Fan,
  Footprints,
  LayoutGrid,
  Library,
  Microwave,
  Monitor,
  Refrigerator,
  Rows3,
  Shirt,
  Sofa,
  Table,
  UtensilsCrossed,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORIES } from '@/lib/categories';
import type { TabId } from '@/lib/types';

/**
 * 탭 id 에 아이콘만 붙인다. 카테고리 목록·순서·라벨은 lib/categories 가 갖는다.
 * QuickSpaceFinder 와 같은 방식이라, 두 줄이 같은 아이콘 체계로 읽힌다.
 *
 * TabId 전체를 덮어 둔다. shelf 는 지금 '책상/선반' 탭에 묶여 따로 노출되지
 * 않지만, 나중에 탭이 늘어날 때 아이콘을 빠뜨리면 타입이 잡아 준다.
 */
const ICONS: Record<TabId, LucideIcon> = {
  all: LayoutGrid,
  refrigerator: Refrigerator,
  washing_machine: WashingMachine,
  dryer: Fan,
  dishwasher: UtensilsCrossed,
  microwave: Microwave,
  desk: Monitor,
  shelf: Library,
  folding_table: Table,
  niche: Rows3,
  bed: Bed,
  sofa: Sofa,
  hanger: Shirt,
  shoe_rack: Footprints,
};

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
        const Icon = ICONS[category.id];
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
            {/* 글자보다 세지 않게 — 색도 한 단계 낮춘다 */}
            <Icon
              className={[
                'h-3.5 w-3.5 shrink-0',
                active ? 'text-white/90' : 'text-slate-400',
              ].join(' ')}
              aria-hidden="true"
            />
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
