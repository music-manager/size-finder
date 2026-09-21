import type { CategoryId, TabId } from './types';

export interface CategoryMeta {
  id: TabId;
  label: string;
}

/** 필터 탭에 노출되는 카테고리 목록 (순서 고정) */
export const CATEGORIES: CategoryMeta[] = [
  { id: 'all', label: '전체' },
  { id: 'refrigerator', label: '소형냉장고' },
  { id: 'washing_machine', label: '미니세탁기' },
  { id: 'dryer', label: '미니건조기' },
  { id: 'dishwasher', label: '미니식기세척기' },
  { id: 'microwave', label: '전자레인지장' },
  { id: 'desk', label: '책상/선반' },
  { id: 'folding_table', label: '접이식테이블' },
  { id: 'niche', label: '틈새수납/트롤리' },
  { id: 'bed', label: '침대' },
  { id: 'sofa', label: '소파/좌식' },
  { id: 'hanger', label: '행거/옷장' },
  { id: 'shoe_rack', label: '신발장' },
];

/**
 * '책상/선반' 탭 하나로 desk + shelf 를 동시에 보여준다.
 * 탭 id -> 실제 product.category 목록 매핑.
 */
export const CATEGORY_MATCH: Record<TabId, CategoryId[] | null> = {
  all: null,
  refrigerator: ['refrigerator'],
  washing_machine: ['washing_machine'],
  dryer: ['dryer'],
  microwave: ['microwave'],
  desk: ['desk', 'shelf'],
  shelf: ['desk', 'shelf'],
  bed: ['bed'],
  hanger: ['hanger'],
  niche: ['niche'],
  sofa: ['sofa'],
  dishwasher: ['dishwasher'],
  folding_table: ['folding_table'],
  shoe_rack: ['shoe_rack'],
};

/** 카드 뱃지에 쓰이는 단일 카테고리 라벨 */
export const CATEGORY_LABEL: Record<CategoryId, string> = {
  refrigerator: '소형냉장고',
  washing_machine: '미니세탁기',
  dryer: '미니건조기',
  microwave: '전자레인지',
  desk: '책상',
  shelf: '선반/수납',
  bed: '침대',
  hanger: '행거/옷장',
  niche: '틈새수납',
  sofa: '소파/좌식',
  dishwasher: '식기세척기',
  folding_table: '접이식테이블',
  shoe_rack: '신발장',
};

const TAB_IDS = new Set<string>(CATEGORIES.map((c) => c.id));

export function isTabId(value: string | null | undefined): value is TabId {
  return !!value && TAB_IDS.has(value);
}
