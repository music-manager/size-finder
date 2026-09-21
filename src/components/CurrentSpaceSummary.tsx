'use client';

import { Pencil, Ruler } from 'lucide-react';
import type { Filters } from '@/lib/types';

interface Props {
  filters: Filters;
  /** 히어로의 치수 입력으로 되돌려 보낸다 */
  onEdit: () => void;
}

/**
 * 데스크톱 사이드바 상단의 현재 치수 요약.
 *
 * 치수를 "고치는 곳"은 히어로 한 군데로 모으고, 사이드바에서는 지금 어떤
 * 숫자로 거르는 중인지만 읽게 한다. 입력을 두 벌 두지 않기 위한 장치다.
 */
export default function CurrentSpaceSummary({ filters, onEdit }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5">
      <p className="min-w-0 text-[13px] leading-tight text-slate-600">
        <span className="flex items-center gap-1 text-[11px] font-bold text-brand-700">
          <Ruler className="h-3 w-3" aria-hidden="true" />
          현재 공간
        </span>
        <span className="mt-0.5 block font-extrabold tabular-nums text-slate-900">
          {filters.maxWidth} × {filters.maxDepth} × {filters.maxHeight}
          <span className="font-bold text-slate-500">cm</span>
        </span>
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-700 transition hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
        치수 수정
      </button>
    </div>
  );
}
