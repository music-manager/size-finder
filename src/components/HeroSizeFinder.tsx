'use client';

import { Ruler, Search } from 'lucide-react';
import DimensionNumberInput from './DimensionNumberInput';
import SpaceDiagram from './SpaceDiagram';
import { DIMENSION_BOUNDS, DIMENSION_MIN } from '@/lib/products';
import type { Filters } from '@/lib/types';

interface Props {
  filters: Filters;
  /** 현재 조건으로 남는 상품 수 */
  resultCount: number;
  onPatch: (patch: Partial<Filters>) => void;
  /** 결과 영역으로 내려보낸다 */
  onSubmit: () => void;
}

/**
 * 첫 화면의 주인공.
 *
 * 센치픽은 "쇼핑몰"이 아니라 "재서 찾는 도구"다. 그래서 히어로를 배너가 아니라
 * 검색 인터페이스로 둔다. 모바일에서도 드로어를 열지 않고 여기서 바로
 * 가로·깊이·높이를 넣을 수 있어야 한다.
 *
 * 값은 전부 상위의 filters 를 그대로 읽고 쓴다. 별도 state 를 두지 않으므로
 * 슬라이더·프리셋·드로어와 항상 같은 숫자를 가리킨다.
 */
export default function HeroSizeFinder({
  filters,
  resultCount,
  onPatch,
  onSubmit,
}: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-100 bg-brand-50/70">
      <div className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:gap-8 lg:px-8 lg:py-8">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm">
            <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
            실측 기반 검색
          </p>

          <h1 className="mt-2.5 text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[26px] lg:text-[36px]">
            줄자로 잰 숫자만 넣으세요.
            <br />
            <span className="text-brand-700">들어가는 제품만</span> 남습니다.
          </h1>

          <p className="mt-2 text-[13px] leading-relaxed text-slate-600 sm:text-[15px]">
            원룸·자취방의 빈 공간을 재고 가로 × 깊이 × 높이를 입력하세요.
          </p>

          {/* 이 사이트의 핵심 입력 — 모바일에서도 접히지 않게 한 줄에 셋 */}
          <div className="mt-4 flex items-start gap-2 sm:gap-3">
            <DimensionNumberInput
              label="가로"
              axis="W"
              value={filters.maxWidth}
              min={DIMENSION_MIN}
              max={DIMENSION_BOUNDS.width}
              onChange={(maxWidth) => onPatch({ maxWidth })}
            />
            <DimensionNumberInput
              label="깊이"
              axis="D"
              value={filters.maxDepth}
              min={DIMENSION_MIN}
              max={DIMENSION_BOUNDS.depth}
              onChange={(maxDepth) => onPatch({ maxDepth })}
            />
            <DimensionNumberInput
              label="높이"
              axis="H"
              value={filters.maxHeight}
              min={DIMENSION_MIN}
              max={DIMENSION_BOUNDS.height}
              onChange={(maxHeight) => onPatch({ maxHeight })}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={onSubmit}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 active:scale-[0.99] lg:px-7 lg:py-3.5 lg:text-[15px]"
            >
              <Search className="h-4 w-4" aria-hidden="true" />내 공간에 맞는 상품
              찾기
            </button>
            <p className="text-[13px] font-semibold text-slate-500">
              조건에 맞는 상품{' '}
              <span className="font-extrabold tabular-nums text-brand-600">
                {resultCount}
              </span>
              개
            </p>
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
            실측값에서 2~5cm 정도 빼고 넣으면 설치까지 안전합니다.
          </p>
        </div>

        {/* 그림은 입력을 밀어내지 않도록 모바일에서 숨긴다.
            배경 위에 그대로 얹어 카피·입력보다 뒤에 있게 둔다. */}
        <div className="hidden lg:block">
          <SpaceDiagram className="h-auto w-full" />
        </div>
      </div>
    </section>
  );
}
