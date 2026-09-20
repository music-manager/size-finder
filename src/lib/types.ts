export type CategoryId =
  | 'refrigerator'
  | 'washing_machine'
  | 'dryer'
  | 'microwave'
  | 'desk'
  | 'shelf'
  | 'bed'
  | 'hanger'
  | 'niche'
  | 'sofa'
  | 'dishwasher'
  | 'folding_table'
  | 'shoe_rack';

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
  /** 쿠팡 상품 번호. 자동 수집분에만 있으며 재수집 시 중복·가격 갱신 판단에 쓴다 */
  productId?: number;
}

/**
 * 쿠팡 API 로 수집했지만 치수를 몰라 아직 사이트에 못 올린 상품.
 * API 가 치수를 주지 않으므로, 관리자가 상세페이지를 보고 3개만 채우면 된다.
 */
export interface PendingProduct extends Omit<Product, 'dimensions' | 'verified'> {
  keyword: string;
  rank: number | null;
  collectedAt: string;
}

export type TabId = CategoryId | 'all';

export type SortKey = 'default' | 'width' | 'depth' | 'size' | 'price';

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
