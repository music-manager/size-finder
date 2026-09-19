'use client';

import { PackageSearch, RotateCcw } from 'lucide-react';

interface Props {
  onReset: () => void;
}

export default function EmptyState({ onReset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <PackageSearch className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-bold text-slate-900">
        입력한 치수에 들어가는 제품이 없어요
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
        가로·깊이·높이 중 하나만 살짝 늘려보거나, 카테고리를 전체로 바꾸면 맞는
        제품이 나올 수 있어요.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700 active:scale-[0.99]"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        필터 초기화하기
      </button>
    </div>
  );
}
