import type { CategoryId } from './types';

export interface CategoryMeta {
  id: CategoryId | 'all';
  label: string;
  emoji: string;
}

/** 필터 탭에 노출되는 카테고리 목록 (순서 고정) */
export const CATEGORIES: CategoryMeta[] = [
  { id: 'all', label: '전체', emoji: '🏠' },
  { id: 'refrigerator', label: '소형냉장고', emoji: '🧊' },
  { id: 'washing_machine', label: '미니세탁기', emoji: '🫧' },
  { id: 'microwave', label: '전자레인지장', emoji: '🍚' },
  { id: 'desk', label: '책상/선반', emoji: '🪑' },
];

/**
 * '책상/선반' 탭 하나로 desk + shelf 를 동시에 보여준다.
 * 탭 id -> 실제 product.category 목록 매핑.
 */
export const CATEGORY_MATCH: Record<CategoryId | 'all', CategoryId[] | null> = {
  all: null,
  refrigerator: ['refrigerator'],
  washing_machine: ['washing_machine'],
  microwave: ['microwave'],
  desk: ['desk', 'shelf'],
  shelf: ['desk', 'shelf'],
};

/** 카드 뱃지에 쓰이는 단일 카테고리 라벨 */
export const CATEGORY_LABEL: Record<CategoryId, string> = {
  refrigerator: '소형냉장고',
  washing_machine: '미니세탁기',
  microwave: '전자레인지',
  desk: '책상',
  shelf: '선반/수납',
};
