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
  /** 참고 가격(원). 쿠팡 가격은 수시로 바뀌므로 없으면 표시하지 않는다 */
  price?: number;
  /** 가격을 확인한 날짜 (YYYY-MM-DD). 가격과 함께 기준일을 노출해 오인을 막는다 */
  priceCheckedAt?: string;
}

export type TabId = CategoryId | 'all';

export type SortKey = 'default' | 'size' | 'price';

export interface Filters {
  /** 'all' 이면 전체 카테고리 */
  category: TabId;
  maxWidth: number;
  maxDepth: number;
  maxHeight: number;
  keyword: string;
  sort: SortKey;
  /** 로켓배송 제품만 보기 */
  rocketOnly: boolean;
  /** 문을 열 앞쪽 공간까지 포함해서 깊이를 계산할지 */
  doorClearance: boolean;
}

export interface DimensionBounds {
  width: number;
  depth: number;
  height: number;
}
