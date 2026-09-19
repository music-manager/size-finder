'use client';

import { useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import FilterPanel from './FilterPanel';
import type { Filters } from '@/lib/types';

interface Props {
  open: boolean;
  resultCount: number;
  filters: Filters;
  dirty: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPatch: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

export default function MobileFilterDrawer({
  open,
  resultCount,
  filters,
  dirty,
  onOpen,
  onClose,
  onPatch,
  onReset,
}: Props) {
  // 드로어가 열려 있는 동안 배경 스크롤을 잠근다.
  useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      {/* 하단 고정 필터 버튼 (모바일 전용) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center justify-between gap-2 rounded-xl bg-brand-600 px-4 py-3 text-white shadow-lg shadow-brand-600/20 transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-left">
              <span className="block text-[10px] font-medium leading-tight text-brand-100">
                가로 × 깊이 × 높이 (cm)
              </span>
              <span className="block text-sm font-extrabold tabular-nums leading-tight">
                {filters.maxWidth} × {filters.maxDepth} × {filters.maxHeight}
              </span>
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
            {resultCount}개
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="사이즈 필터">
          <button
            type="button"
            aria-label="필터 닫기"
            onClick={onClose}
            className="absolute inset-0 h-full w-full bg-slate-900/50"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-slate-50 pb-6 shadow-2xl animate-fade-up">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">사이즈 필터</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="필터 닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="px-4 pt-4">
              <FilterPanel
                filters={filters}
                dirty={dirty}
                onPatch={onPatch}
                onReset={onReset}
              />
            </div>

            <div className="px-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white transition active:scale-[0.99]"
              >
                {resultCount}개 결과 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
