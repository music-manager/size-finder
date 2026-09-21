'use client';

import { useState } from 'react';
import {
  Bed,
  CookingPot,
  Footprints,
  Monitor,
  Refrigerator,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORY_LABEL } from '@/lib/categories';
import { SPACE_ITEMS, isSpaceActive, resolveSpaceCategory, type SpaceItem } from '@/lib/spaces';
import type { TabId } from '@/lib/types';

/** 항목 id 에 아이콘만 붙인다. 매핑 자체는 lib/spaces 가 갖는다. */
const ICONS: Record<string, LucideIcon> = {
  fridge: Refrigerator,
  laundry: WashingMachine,
  bedside: Bed,
  kitchen: CookingPot,
  desk: Monitor,
  entrance: Footprints,
};

interface Props {
  value: TabId;
  onSelect: (category: TabId) => void;
}

export default function QuickSpaceFinder({ value, onSelect }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleClick = (item: SpaceItem) => {
    const category = resolveSpaceCategory(item);
    if (category) {
      setExpanded(null);
      onSelect(category);
      return;
    }
    // 고를 것이 여러 개면 대신 정하지 않고 물어본다
    setExpanded((prev) => (prev === item.id ? null : item.id));
  };

  const openItem = SPACE_ITEMS.find((item) => item.id === expanded);

  return (
    <section>
      <h2 className="text-sm font-bold text-slate-900">공간별 빠른 찾기</h2>
      <p className="mt-0.5 text-[11px] text-slate-400">
        입력한 치수는 그대로 두고 종류만 바꿉니다.
      </p>

      <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {SPACE_ITEMS.map((item) => {
          const Icon = ICONS[item.id];
          const active = isSpaceActive(item, value);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item)}
              aria-pressed={active}
              aria-expanded={item.choices ? expanded === item.id : undefined}
              className={[
                'flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                active
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50',
              ].join(' ')}
            >
              <Icon
                className={[
                  'h-5 w-5 shrink-0',
                  active ? 'text-brand-600' : 'text-slate-400',
                ].join(' ')}
                aria-hidden="true"
              />
              <span
                className={[
                  'text-center text-[11px] font-bold leading-tight sm:text-xs',
                  active ? 'text-brand-700' : 'text-slate-700',
                ].join(' ')}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {openItem?.choices && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5">
          <span className="text-[11px] font-bold text-slate-500">
            {openItem.label}에서 찾는 것은?
          </span>
          {openItem.choices.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setExpanded(null);
                onSelect(category);
              }}
              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:border-brand-500 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              {CATEGORY_LABEL[category]}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
