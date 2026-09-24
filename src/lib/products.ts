import rawProducts from '@/data/products.json';
import rawPending from '@/data/pending.json';
import rawPendingWashingMachine from '@/data/pending-washing-machine.json';
import rawPendingDryer from '@/data/pending-dryer.json';
import rawPendingMicrowave from '@/data/pending-microwave.json';
import { CATEGORY_MATCH } from './categories';
import type {
  CategoryId,
  PendingProduct,
  DimensionBounds,
  Filters,
  Product,
  SortKey,
} from './types';

export const products = rawProducts as Product[];

/** 치수 입력을 기다리는 자동 수집 상품. 냉장고·세탁기·건조기·전자레인지 배치를 합쳐 관리한다. */
export const pendingProducts = [
  ...(rawPending as PendingProduct[]),
  ...(rawPendingWashingMachine as PendingProduct[]),
  ...(rawPendingDryer as PendingProduct[]),
  ...(rawPendingMicrowave as PendingProduct[]),
];

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
  sort: 'default',
  rocketOnly: false,
  doorClearance: false,
};

/** 소수점 오차로 딱 맞는 제품이 탈락하지 않도록 0.05cm 허용 */
const EPSILON = 0.05;

export function filterProducts(list: Product[], filters: Filters): Product[] {
  const allowed = CATEGORY_MATCH[filters.category];
  const keyword = filters.keyword.trim().toLowerCase();

  return list.filter((product) => {
    if (allowed && !allowed.includes(product.category)) return false;

    if (filters.rocketOnly && !product.tags.includes(ROCKET_TAG)) return false;

    const { width, height } = product.dimensions;
    const depth = effectiveDepth(product, filters.doorClearance);
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
    filters.sort !== DEFAULT_FILTERS.sort ||
    filters.rocketOnly ||
    filters.doorClearance ||
    filters.keyword.trim() !== ''
  );
}

export function formatCm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** 앞으로 문이 열려 설치 시 앞쪽 여유가 필요한 카테고리 */
export const DOOR_CATEGORIES: CategoryId[] = [
  'refrigerator',
  'microwave',
  'dryer',
  'washing_machine',
  'dishwasher',
];

/** 도어 개폐에 필요한 앞쪽 여유 (cm). 업계 통용 최소치 기준 */
export const DOOR_CLEARANCE_CM = 30;

export function needsDoorClearance(product: Product): boolean {
  return DOOR_CATEGORIES.includes(product.category);
}

/** 도어 여유를 포함했을 때 실제로 필요한 깊이 */
export function effectiveDepth(product: Product, doorClearance: boolean): number {
  return doorClearance && needsDoorClearance(product)
    ? product.dimensions.depth + DOOR_CLEARANCE_CM
    : product.dimensions.depth;
}

export const ROCKET_TAG = '로켓배송';

export function sortProducts(list: Product[], sort: SortKey): Product[] {
  if (sort === 'default') return list;
  const next = [...list];

  // 틈새를 찾는 사용자는 폭, 문·동선이 걱정인 사용자는 깊이가 기준이 된다
  if (sort === 'width') {
    next.sort((a, b) => a.dimensions.width - b.dimensions.width);
    return next;
  }

  if (sort === 'depth') {
    next.sort((a, b) => a.dimensions.depth - b.dimensions.depth);
    return next;
  }

  if (sort === 'size') {
    // 부피가 작을수록 좁은 방에 유리하다
    const volume = (p: Product) =>
      p.dimensions.width * p.dimensions.depth * p.dimensions.height;
    next.sort((a, b) => volume(a) - volume(b));
    return next;
  }

  // 가격 미입력 제품은 정렬에서 뒤로 보낸다
  next.sort((a, b) => {
    if (a.price && b.price) return a.price - b.price;
    if (a.price) return -1;
    if (b.price) return 1;
    return 0;
  });
  return next;
}
