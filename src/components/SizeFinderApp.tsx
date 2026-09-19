'use client';

import { useCallback, useMemo, useState } from 'react';
import CategoryTabs from './CategoryTabs';
import FilterPanel from './FilterPanel';
import MobileFilterDrawer from './MobileFilterDrawer';
import ProductGrid from './ProductGrid';
import { CATEGORIES } from '@/lib/categories';
import {
  DEFAULT_FILTERS,
  filterProducts,
  isFilterDirty,
  products,
} from '@/lib/products';
import type { CategoryId, Filters } from '@/lib/types';

export default function SizeFinderApp() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const patchFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const visible = useMemo(
    () => filterProducts(products, filters),
    [filters],
  );

  /** 탭 뱃지 숫자: 카테고리를 제외한 나머지 조건만 적용한 개수 */
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const category of CATEGORIES) {
      result[category.id] = filterProducts(products, {
        ...filters,
        category: category.id,
      }).length;
    }
    return result;
  }, [filters]);

  const dirty = isFilterDirty(filters);

  const handleCategory = useCallback(
    (category: CategoryId | 'all') => patchFilters({ category }),
    [patchFilters],
  );

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16">
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
        <h1 className="text-lg font-extrabold leading-snug sm:text-2xl">
          줄자로 잰 숫자만 넣으세요.
          <br className="sm:hidden" /> 들어가는 제품만 남습니다.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-100">
          원룸·자취방 빈틈에 딱 맞는 소형냉장고 · 미니세탁기 · 전자레인지 ·
          책상 · 선반을 가로(W) × 깊이(D) × 높이(H) 기준으로 골라드립니다.
        </p>
      </section>

      <div className="mt-6">
        <CategoryTabs
          value={filters.category}
          counts={counts}
          onChange={handleCategory}
        />
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-8">
        {/* 데스크톱: 스티키 사이드 필터 */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <FilterPanel
              filters={filters}
              dirty={dirty}
              onPatch={patchFilters}
              onReset={resetFilters}
            />
          </div>
        </aside>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">
              검색 결과{' '}
              <span className="text-brand-600">{visible.length}</span>개
            </p>
            <p className="text-xs text-slate-400">
              최대 {filters.maxWidth} × {filters.maxDepth} ×{' '}
              {filters.maxHeight} cm 이하
            </p>
          </div>

          <ProductGrid products={visible} onReset={resetFilters} />
        </section>
      </div>

      {/* 모바일: 하단 고정 버튼 + 드로어 필터 */}
      <MobileFilterDrawer
        open={drawerOpen}
        resultCount={visible.length}
        filters={filters}
        dirty={dirty}
        onOpen={() => setDrawerOpen(true)}
        onClose={closeDrawer}
        onPatch={patchFilters}
        onReset={resetFilters}
      />
    </div>
  );
}
