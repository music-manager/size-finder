export type CategoryId =
  | 'refrigerator'
  | 'washing_machine'
  | 'microwave'
  | 'desk'
  | 'shelf';

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
}

export interface Filters {
  /** 'all' 이면 전체 카테고리 */
  category: CategoryId | 'all';
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
