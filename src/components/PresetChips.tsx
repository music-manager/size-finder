'use client';

import { Home, Zap } from 'lucide-react';
import {
  ROOM_PRESETS,
  SPEC_PRESETS,
  isRoomPresetActive,
  isSpecPresetActive,
  type RoomPreset,
  type SpecPreset,
} from '@/lib/presets';
import type { Filters } from '@/lib/types';

interface Props {
  filters: Filters;
  onRoomPreset: (preset: RoomPreset) => void;
  onSpecPreset: (preset: SpecPreset) => void;
}

export default function PresetChips({
  filters,
  onRoomPreset,
  onSpecPreset,
}: Props) {
  return (
    <div className="space-y-4">
      <section>
        <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          내 방 평수로 한 번에 맞추기
        </h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ROOM_PRESETS.map((preset) => {
            const active = isRoomPresetActive(filters, preset);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onRoomPreset(preset)}
                aria-pressed={active}
                className={[
                  'rounded-xl border px-2 py-2.5 text-center transition',
                  active
                    ? 'border-brand-600 bg-brand-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-brand-300',
                ].join(' ')}
              >
                <span
                  className={[
                    'block text-sm font-bold',
                    active ? 'text-brand-700' : 'text-slate-800',
                  ].join(' ')}
                >
                  {preset.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">
                  {preset.sub}
                </span>
                <span className="mt-1 block text-[10px] font-semibold tabular-nums text-slate-500">
                  {preset.maxWidth}×{preset.maxDepth}×{preset.maxHeight}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          침대·행거는 길이가 고정이라 아래 규격 버튼에서 골라주세요.
        </p>
      </section>

      <section>
        <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          규격으로 바로 찾기
        </h2>
        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:px-0">
          {SPEC_PRESETS.map((preset) => {
            const active = isSpecPresetActive(filters, preset);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSpecPreset(preset)}
                aria-pressed={active}
                className={[
                  'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900',
                ].join(' ')}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
