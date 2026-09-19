'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CategoryTabs from './CategoryTabs';
import FilterPanel from './FilterPanel';
import MobileFilterDrawer from './MobileFilterDrawer';
import PresetChips from './PresetChips';
import ProductGrid from './ProductGrid';
import ShareButton from './ShareButton';
import SortSelect from './SortSelect';
import { CATEGORIES } from '@/lib/categories';
import {
  DEFAULT_FILTERS,
  filterProducts,
  isFilterDirty,
  products,
  sortProducts,
} from '@/lib/products';
import {
  applyRoomPreset,
  applySpecPreset,
  type RoomPreset,
  type SpecPreset,
} from '@/lib/presets';
import { filtersToQueryString, paramsToFilters } from '@/lib/urlState';
import type { Filters, SortKey, TabId } from '@/lib/types';

export default function SizeFinderApp() {
  const searchParams = useSearchParams();

  // 공유 링크로 들어온 경우 URL 쿼리를 초기 상태로 복원한다.
  const [filters, setFilters] = useState<Filters>(() =>
    paramsToFilters(new URLSearchParams(searchParams.toString())),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 상태 -> URL 반영. 슬라이더 드래그마다 호출되면 사파리가 replaceState 를
  // 스로틀링하므로 짧게 디바운스한다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = filtersToQueryString(filters);
      window.history.replaceState(null, '', `${window.location.pathname}${query}`);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const patchFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleRoomPreset = useCallback((preset: RoomPreset) => {
    setFilters((prev) => applyRoomPreset(prev, preset));
  }, []);

  const handleSpecPreset = useCallback((preset: SpecPreset) => {
    setFilters(applySpecPreset(preset));
  }, []);

  const visible = useMemo(
    () => sortProducts(filterProducts(products, filters), filters.sort),
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
    (category: TabId) => patchFilters({ category }),
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
          원룸·자취방 빈틈에 딱 맞는 소형냉장고 · 미니세탁기 · 미니건조기 ·
          전자레인지 · 책상 · 선반 · 침대 · 행거를 가로(W) × 깊이(D) × 높이(H)
          기준으로 골라드립니다.
        </p>
      </section>

      <div className="mt-6">
        <PresetChips
          filters={filters}
          onRoomPreset={handleRoomPreset}
          onSpecPreset={handleSpecPreset}
        />
      </div>

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">
              검색 결과 <span className="text-brand-600">{visible.length}</span>
              개
              <span className="ml-2 text-xs font-normal text-slate-400">
                최대 {filters.maxWidth} × {filters.maxDepth} ×{' '}
                {filters.maxHeight} cm 이하
              </span>
            </p>
            <div className="flex items-center gap-2">
              <SortSelect
                value={filters.sort}
                onChange={(sort: SortKey) => patchFilters({ sort })}
              />
              <ShareButton />
            </div>
          </div>

          <ProductGrid
            products={visible}
            doorClearance={filters.doorClearance}
            onReset={resetFilters}
          />
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
