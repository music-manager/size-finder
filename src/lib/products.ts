import rawProducts from '@/data/products.json';
import { CATEGORY_MATCH } from './categories';
import type { DimensionBounds, Filters, Product } from './types';

export const products = rawProducts as Product[];

/** 슬라이더 최대값: 실데이터 최대치를 10cm 단위로 올림 (여유 10cm) */
function ceilTo10(value: number): number {
  return Math.ceil(value / 10) * 10;
}

export const DIMENSION_BOUNDS: DimensionBounds = {
  width: ceilTo10(Math.max(...products.map((p) => p.dimensions.width)) + 10),
  depth: ceilTo10(Math.max(...products.map((p) => p.dimensions.depth)) + 10),
  height: ceilTo10(Math.max(...products.map((p) => p.dimensions.height)) + 10),
};

export const DIMENSION_MIN = 10;

export const DEFAULT_FILTERS: Filters = {
  category: 'all',
  maxWidth: DIMENSION_BOUNDS.width,
  maxDepth: DIMENSION_BOUNDS.depth,
  maxHeight: DIMENSION_BOUNDS.height,
  keyword: '',
};

/** 소수점 오차로 딱 맞는 제품이 탈락하지 않도록 0.05cm 허용 */
const EPSILON = 0.05;

export function filterProducts(list: Product[], filters: Filters): Product[] {
  const allowed = CATEGORY_MATCH[filters.category];
  const keyword = filters.keyword.trim().toLowerCase();

  return list.filter((product) => {
    if (allowed && !allowed.includes(product.category)) return false;

    const { width, depth, height } = product.dimensions;
    if (width > filters.maxWidth + EPSILON) return false;
    if (depth > filters.maxDepth + EPSILON) return false;
    if (height > filters.maxHeight + EPSILON) return false;

    if (keyword) {
      const haystack = [
        product.name,
        product.brand,
        product.capacity_or_spec,
        ...product.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });
}

/** 필터가 기본값에서 벗어났는지 (초기화 버튼 활성화 판단용) */
export function isFilterDirty(filters: Filters): boolean {
  return (
    filters.category !== DEFAULT_FILTERS.category ||
    filters.maxWidth !== DEFAULT_FILTERS.maxWidth ||
    filters.maxDepth !== DEFAULT_FILTERS.maxDepth ||
    filters.maxHeight !== DEFAULT_FILTERS.maxHeight ||
    filters.keyword.trim() !== ''
  );
}

export function formatCm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
