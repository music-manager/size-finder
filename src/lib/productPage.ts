import {
  DOOR_CLEARANCE_CM,
  formatCm,
  needsDoorClearance,
  products,
} from './products';
import type { Product } from './types';

export const SITE_URL = 'https://cmpick.esedy.com';

export function findProduct(id: string, list: Product[] = products): Product | undefined {
  return list.find((p) => p.id === id);
}

/** "49 × 41.8 × 63.1" */
export function dimensionText(product: Product): string {
  const { width, depth, height } = product.dimensions;
  return `${formatCm(width)} × ${formatCm(depth)} × ${formatCm(height)}`;
}

/** 검색에 그대로 걸리는 제목: "제품명 크기 49×41.8×63.1cm" */
export function pageTitle(product: Product): string {
  return `${product.name} 크기 ${dimensionText(product).replace(/ /g, '')}cm`;
}

export function pageDescription(product: Product): string {
  const { width, depth, height } = product.dimensions;
  const door = needsDoorClearance(product)
    ? ` 문을 열면 앞쪽으로 ${formatCm(depth + DOOR_CLEARANCE_CM)}cm 공간이 필요합니다.`
    : '';
  return (
    `${product.name}의 실측 크기는 가로 ${formatCm(width)}cm, 깊이 ${formatCm(depth)}cm, ` +
    `높이 ${formatCm(height)}cm 입니다.${door} 내 원룸 빈 공간에 들어가는지 바로 확인하세요.`
  );
}

/** 부피가 가까운 같은 카테고리 제품 — 대안을 바로 보여줘 이탈을 줄인다 */
export function similarProducts(
  product: Product,
  count = 4,
  list: Product[] = products,
): Product[] {
  const volume = (p: Product) =>
    p.dimensions.width * p.dimensions.depth * p.dimensions.height;
  const base = volume(product);

  return list
    .filter((p) => p.id !== product.id && p.category === product.category)
    .sort((a, b) => Math.abs(volume(a) - base) - Math.abs(volume(b) - base))
    .slice(0, count);
}
