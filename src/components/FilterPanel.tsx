'use client';

import { RotateCcw, Rocket, DoorOpen } from 'lucide-react';
import DimensionSlider from './DimensionSlider';
import SearchBar from './SearchBar';
import { DIMENSION_BOUNDS, DIMENSION_MIN, DOOR_CLEARANCE_CM } from '@/lib/products';
import type { Filters } from '@/lib/types';

interface Props {
  filters: Filters;
  dirty: boolean;
  onPatch: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

export default function FilterPanel({
  filters,
  dirty,
  onPatch,
  onReset,
}: Props) {
  return (
    <div className="space-y-6">
      <SearchBar
        value={filters.keyword}
        onChange={(keyword) => onPatch({ keyword })}
      />

      <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="whitespace-nowrap text-sm font-bold text-slate-900">
            📐 내 공간 최대 치수
          </h2>
          <button
            type="button"
            onClick={onReset}
            disabled={!dirty}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition enabled:hover:bg-slate-100 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            초기화
          </button>
        </div>

        <DimensionSlider
          label="최대 가로"
          hint="W"
          value={filters.maxWidth}
          min={DIMENSION_MIN}
          max={DIMENSION_BOUNDS.width}
          onChange={(maxWidth) => onPatch({ maxWidth })}
        />
        <DimensionSlider
          label="최대 깊이"
          hint="D"
          value={filters.maxDepth}
          min={DIMENSION_MIN}
          max={DIMENSION_BOUNDS.depth}
          onChange={(maxDepth) => onPatch({ maxDepth })}
        />
        <DimensionSlider
          label="최대 높이"
          hint="H"
          value={filters.maxHeight}
          min={DIMENSION_MIN}
          max={DIMENSION_BOUNDS.height}
          onChange={(maxHeight) => onPatch({ maxHeight })}
        />

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={filters.doorClearance}
              onChange={(e) => onPatch({ doorClearance: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-600"
            />
            <span>
              <span className="flex items-center gap-1 text-[13px] font-bold text-slate-800">
                <DoorOpen className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                도어 개폐 공간 포함
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                냉장고·전자레인지·건조기·세탁기는 문을 열 앞쪽 공간이 필요합니다.
                깊이에 {DOOR_CLEARANCE_CM}cm 를 더해서 계산합니다.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filters.rocketOnly}
              onChange={(e) => onPatch({ rocketOnly: e.target.checked })}
              className="h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-600"
            />
            <span className="flex items-center gap-1 text-[13px] font-bold text-slate-800">
              <Rocket className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
              로켓배송만 보기
            </span>
          </label>
        </div>

        <p className="rounded-lg bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-800">
          💡 벽·문틀 여유를 위해 실측값에서 2~5cm 빼고 입력하면 설치 실패를
          막을 수 있어요.
        </p>
      </div>
    </div>
  );
}
