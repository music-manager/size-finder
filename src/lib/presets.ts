import { DEFAULT_FILTERS } from './products';
import type { Filters, TabId } from './types';

export interface RoomPreset {
  id: string;
  label: string;
  sub: string;
  maxWidth: number;
  maxDepth: number;
  maxHeight: number;
}

/**
 * 평수별 프리셋 = 그 평수 원룸에서 '가전을 놓을 수 있는' 현실적인 최대 치수.
 * 침대·행거는 평수와 무관하게 길이가 고정이라 아래 SPEC_PRESETS 로 분리했다.
 */
export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: 'py5',
    label: '5평 원룸',
    sub: '틈새·미니 가전 위주',
    maxWidth: 60,
    maxDepth: 60,
    maxHeight: 130,
  },
  {
    id: 'py7',
    label: '7평 원룸',
    sub: '일반 원룸 표준',
    maxWidth: 90,
    maxDepth: 65,
    maxHeight: 160,
  },
  {
    id: 'py10',
    label: '10평 오피스텔',
    sub: '풀사이즈 가전 가능',
    maxWidth: 130,
    maxDepth: 70,
    maxHeight: 190,
  },
];

export interface SpecPreset {
  id: string;
  label: string;
  category: TabId;
  maxWidth?: number;
  maxDepth?: number;
  maxHeight?: number;
}

/** 검색 의도 그대로를 한 번에 눌러 들어오는 규격 프리셋 */
export const SPEC_PRESETS: SpecPreset[] = [
  { id: 'dryer-w60', label: '가로 60cm 이하 미니건조기', category: 'dryer', maxWidth: 60 },
  { id: 'ref-h140', label: '높이 140cm 이하 소형냉장고', category: 'refrigerator', maxHeight: 140 },
  { id: 'wsh-w50', label: '가로 50cm 이하 미니세탁기', category: 'washing_machine', maxWidth: 50 },
  { id: 'mic-d35', label: '깊이 35cm 이하 전자레인지', category: 'microwave', maxDepth: 35 },
  { id: 'desk-d40', label: '깊이 40cm 이하 책상', category: 'desk', maxDepth: 40 },
  { id: 'shelf-w30', label: '폭 30cm 이하 틈새선반', category: 'desk', maxWidth: 30 },
  { id: 'bed-w120', label: '폭 120cm 이하 싱글·SS 침대', category: 'bed', maxWidth: 120 },
  { id: 'hanger-w100', label: '가로 100cm 이하 행거', category: 'hanger', maxWidth: 100 },
];

/** 평수 프리셋 적용: 카테고리·검색어는 유지하고 치수 3개만 덮어쓴다 */
export function applyRoomPreset(current: Filters, preset: RoomPreset): Filters {
  return {
    ...current,
    maxWidth: preset.maxWidth,
    maxDepth: preset.maxDepth,
    maxHeight: preset.maxHeight,
  };
}

/** 규격 프리셋 적용: 기본값에서 시작해 해당 조건만 건다 (이전 필터 잔재 제거) */
export function applySpecPreset(preset: SpecPreset): Filters {
  return {
    ...DEFAULT_FILTERS,
    category: preset.category,
    maxWidth: preset.maxWidth ?? DEFAULT_FILTERS.maxWidth,
    maxDepth: preset.maxDepth ?? DEFAULT_FILTERS.maxDepth,
    maxHeight: preset.maxHeight ?? DEFAULT_FILTERS.maxHeight,
  };
}

export function isRoomPresetActive(filters: Filters, preset: RoomPreset): boolean {
  return (
    filters.maxWidth === preset.maxWidth &&
    filters.maxDepth === preset.maxDepth &&
    filters.maxHeight === preset.maxHeight
  );
}

export function isSpecPresetActive(filters: Filters, preset: SpecPreset): boolean {
  const applied = applySpecPreset(preset);
  return (
    filters.category === applied.category &&
    filters.maxWidth === applied.maxWidth &&
    filters.maxDepth === applied.maxDepth &&
    filters.maxHeight === applied.maxHeight
  );
}
