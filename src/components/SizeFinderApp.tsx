'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CategoryTabs from './CategoryTabs';
import CurrentSpaceSummary from './CurrentSpaceSummary';
import FilterPanel from './FilterPanel';
import HeroSizeFinder from './HeroSizeFinder';
import MobileFilterDrawer from './MobileFilterDrawer';
import PresetChips from './PresetChips';
import AffiliateNotice from './AffiliateNotice';
import ProductGrid from './ProductGrid';
import QuickSpaceFinder from './QuickSpaceFinder';
import ReviewCatalogSection from './ReviewCatalogSection';
import ShareButton from './ShareButton';
import SortSelect from './SortSelect';
import { CATEGORIES, CATEGORY_MATCH } from '@/lib/categories';
import {
  DEFAULT_FILTERS,
  filterProducts,
  isFilterDirty,
  products as seedProducts,
  sortProducts,
} from '@/lib/products';
import {
  applyRoomPreset,
  applySpecPreset,
  type RoomPreset,
  type SpecPreset,
} from '@/lib/presets';
import { isSizeFilterActive } from '@/lib/fit';
import { publicCountFor, uniqueProductIdsFor } from '@/lib/publicCatalog';
import { SEED_PAGE_KEYS, getPublicCatalog } from '@/lib/publicCatalogData';
import { filtersToQueryString, paramsToFilters } from '@/lib/urlState';
import type { Filters, Product, SortKey, TabId } from '@/lib/types';

interface Props {
  initialProducts?: Product[];
}

export default function SizeFinderApp({ initialProducts = seedProducts }: Props) {
  const searchParams = useSearchParams();
  // 공간 맞춤(필터 · fit)에는 verified 만 들어간다. REVIEW 는 아래 별도 영역에만 보인다.
  const publicCatalog = useMemo(() => getPublicCatalog(initialProducts), [initialProducts]);
  const catalog = publicCatalog.verified;
  const reviewCandidates = publicCatalog.review;

  // 공유 링크로 들어온 경우 URL 쿼리를 초기 상태로 복원한다.
  const [filters, setFilters] = useState<Filters>(() =>
    paramsToFilters(new URLSearchParams(searchParams.toString())),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

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
    () => sortProducts(filterProducts(catalog, filters), filters.sort),
    [catalog, filters],
  );

  // 탭 숫자는 공개 고유상품 수(서로 다른 쿠팡 productId, verified + review).
  // productId 없는 실측 카드는 화면에는 보이지만 이 숫자에는 들어가지 않는다. 공간 맞춤 결과 수와도 다르다.
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const category of CATEGORIES) {
      result[category.id] = uniqueProductIdsFor(publicCatalog, CATEGORY_MATCH[category.id], SEED_PAGE_KEYS);
    }
    return result;
  }, [publicCatalog]);

  // 이 카테고리에 치수 확인을 마친 상품이 아예 없으면 "치수에 맞는 제품이 없다" 대신 안내만 한다
  const allowedCategories = CATEGORY_MATCH[filters.category];
  const verifiedInCategory = publicCountFor({ verified: catalog, review: [] }, allowedCategories);
  const reviewInCategory = publicCountFor({ verified: [], review: reviewCandidates }, allowedCategories);
  const onlyReviewInCategory = verifiedInCategory === 0 && reviewInCategory > 0;

  const dirty = isFilterDirty(filters);
  const sizeFilterActive = isSizeFilterActive(filters, DEFAULT_FILTERS);
  const fitContext = sizeFilterActive
    ? {
        maxWidth: filters.maxWidth,
        maxDepth: filters.maxDepth,
        maxHeight: filters.maxHeight,
      }
    : undefined;

  const scrollToResults = useCallback(() => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToHero = useCallback(() => {
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleCategory = useCallback(
    (category: TabId) => patchFilters({ category }),
    [patchFilters],
  );

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-8">
      <div ref={heroRef} className="scroll-mt-20">
        <HeroSizeFinder
          filters={filters}
          resultCount={visible.length}
          onPatch={patchFilters}
          onSubmit={scrollToResults}
        />
      </div>

      <div className="mt-5">
        <QuickSpaceFinder value={filters.category} onSelect={handleCategory} />
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">
            <CurrentSpaceSummary filters={filters} onEdit={scrollToHero} />
            <FilterPanel
              filters={filters}
              dirty={dirty}
              onPatch={patchFilters}
              onReset={resetFilters}
              showDimensions={false}
            />
          </div>
        </aside>

        <section ref={resultsRef} id="results" className="scroll-mt-24">
          <PresetChips
            filters={filters}
            onRoomPreset={handleRoomPreset}
            onSpecPreset={handleSpecPreset}
          />

          <div className="mt-4">
            <CategoryTabs
              value={filters.category}
              counts={counts}
              onChange={handleCategory}
            />
          </div>

          <h2 className="mt-5 text-base font-extrabold text-slate-900">공간 맞춤 확인 완료</h2>

          <div className="mb-3 mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-sm font-bold text-slate-900">
              {sizeFilterActive ? '내 공간에 맞는 상품 ' : '검색 결과 '}
              <span className="text-brand-600">{visible.length}</span>개
              <span className="ml-2 block text-xs font-normal tabular-nums text-slate-400 sm:ml-2 sm:inline">
                {filters.maxWidth} × {filters.maxDepth} × {filters.maxHeight}cm 이하
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

          {/* 쿠팡 상품 카드가 나오는 목록 바로 위에 파트너스 고지를 1회 표시한다 */}
          {(visible.length > 0 || reviewCandidates.length > 0) && <AffiliateNotice className="mb-3" />}

          {onlyReviewInCategory ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600">
              이 카테고리는 아직 치수 확인을 마친 상품이 없어 공간 맞춤 결과가 없습니다. 아래 실제
              상품은 치수를 확인하는 중입니다.
            </p>
          ) : (
            <ProductGrid
              products={visible}
              doorClearance={filters.doorClearance}
              fitContext={fitContext}
              onReset={resetFilters}
            />
          )}

          <ReviewCatalogSection candidates={reviewCandidates} category={filters.category} />
        </section>
      </div>

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
