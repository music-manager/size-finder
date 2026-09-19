export type CategoryId =
  | 'refrigerator'
  | 'washing_machine'
  | 'dryer'
  | 'microwave'
  | 'desk'
  | 'shelf'
  | 'bed'
  | 'hanger';

export interface Dimensions {
  /** 가로 (cm) */
  width: number;
  /** 깊이 (cm) */
  depth: number;
  /** 높이 (cm) */
  height: number;
}

export interface Product {
  id: string;
  name: string;
  category: CategoryId;
  brand: string;
  dimensions: Dimensions;
  capacity_or_spec: string;
  imageUrl: string;
  coupangUrl: string;
  tags: string[];
  /** 제조사/상세페이지 스펙으로 치수를 직접 확인했는지 여부 */
  verified: boolean;
}

export type TabId = CategoryId | 'all';

export interface Filters {
  /** 'all' 이면 전체 카테고리 */
  category: TabId;
  maxWidth: number;
  maxDepth: number;
  maxHeight: number;
  keyword: string;
}

export interface DimensionBounds {
  width: number;
  depth: number;
  height: number;
}
