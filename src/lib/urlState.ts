import { isTabId } from './categories';
import { DEFAULT_FILTERS, DIMENSION_BOUNDS, DIMENSION_MIN } from './products';
import type { Filters, SortKey } from './types';

/**
 * 필터 상태를 URL 쿼리로 직렬화한다.
 * 블로그 본문·쇼츠 고정댓글에서 "가로 60cm 이하 건조기" 화면으로 바로 보내기 위한 핵심 기능.
 */

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(DIMENSION_MIN, Math.round(value)));
}

function readDimension(
  params: URLSearchParams,
  key: string,
  max: number,
): number {
  const raw = params.get(key);
  if (raw === null) return max;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return max;
  return clamp(parsed, max);
}

export function paramsToFilters(params: URLSearchParams): Filters {
  const category = params.get('c');

  return {
    category: isTabId(category) ? category : DEFAULT_FILTERS.category,
    maxWidth: readDimension(params, 'w', DIMENSION_BOUNDS.width),
    maxDepth: readDimension(params, 'd', DIMENSION_BOUNDS.depth),
    maxHeight: readDimension(params, 'h', DIMENSION_BOUNDS.height),
    keyword: (params.get('q') ?? '').slice(0, 50),
    sort: readSort(params.get('sort')),
    rocketOnly: params.get('rocket') === '1',
    doorClearance: params.get('door') === '1',
  };
}

const SORT_KEYS: SortKey[] = ['default', 'size', 'price'];

function readSort(raw: string | null): SortKey {
  return SORT_KEYS.includes(raw as SortKey)
    ? (raw as SortKey)
    : DEFAULT_FILTERS.sort;
}

/** 기본값과 다른 항목만 담아 URL 을 짧게 유지한다 */
export function filtersToQueryString(filters: Filters): string {
  const params = new URLSearchParams();

  if (filters.category !== DEFAULT_FILTERS.category) {
    params.set('c', filters.category);
  }
  if (filters.maxWidth !== DEFAULT_FILTERS.maxWidth) {
    params.set('w', String(filters.maxWidth));
  }
  if (filters.maxDepth !== DEFAULT_FILTERS.maxDepth) {
    params.set('d', String(filters.maxDepth));
  }
  if (filters.maxHeight !== DEFAULT_FILTERS.maxHeight) {
    params.set('h', String(filters.maxHeight));
  }
  const keyword = filters.keyword.trim();
  if (keyword) {
    params.set('q', keyword);
  }
  if (filters.sort !== DEFAULT_FILTERS.sort) {
    params.set('sort', filters.sort);
  }
  if (filters.rocketOnly) params.set('rocket', '1');
  if (filters.doorClearance) params.set('door', '1');

  const query = params.toString();
  return query ? `?${query}` : '';
}
