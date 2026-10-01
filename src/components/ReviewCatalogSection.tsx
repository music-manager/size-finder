'use client';

import { useEffect, useMemo, useState } from 'react';
import ReviewCard from './ReviewCard';
import { CATEGORY_MATCH } from '@/lib/categories';
import { reviewForCategories, type ReviewCandidate } from '@/lib/publicCatalog';
import type { TabId } from '@/lib/types';

interface Props {
  candidates: ReviewCandidate[];
  /** 카테고리 탭만 따른다. 치수 조건은 적용하지 않는다 */
  category: TabId;
}

const PAGE_SIZE = 8;

export const REVIEW_NOTICE = '치수 확인 전 상품은 공간 적합도 계산에서 제외됩니다.';

export default function ReviewCatalogSection({ candidates, category }: Props) {
  const list = useMemo(
    () => reviewForCategories(candidates, CATEGORY_MATCH[category]),
    [candidates, category],
  );
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => setShown(PAGE_SIZE), [category]);

  if (list.length === 0) return null;
  const visible = list.slice(0, shown);

  return (
    <section aria-labelledby="review-catalog-title" className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="review-catalog-title" className="text-base font-extrabold text-slate-900">
            추가 상품 · 치수 확인 중
            <span className="ml-1.5 text-brand-600 tabular-nums">{list.length}</span>
          </h2>
          <p className="mt-1 text-xs font-semibold text-amber-800">{REVIEW_NOTICE}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((candidate) => (
          <ReviewCard key={candidate.productId} candidate={candidate} />
        ))}
      </div>

      {shown < list.length && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE_SIZE)}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            더보기 ({list.length - shown}개 남음)
          </button>
        </div>
      )}
    </section>
  );
}
