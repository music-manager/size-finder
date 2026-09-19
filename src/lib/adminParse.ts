import type { CategoryId, Product } from './types';

/** 쿠팡 파트너스에서 복사한 덩어리에서 링크·이미지·iframe 을 한 번에 추출한다 */
export interface ParsedBlob {
  coupangUrl: string;
  imageUrl: string;
  htmlTag: string;
}

export function parseCoupangBlob(text: string): ParsedBlob {
  const coupangUrl =
    text.match(/https:\/\/link\.coupang\.com\/a\/[A-Za-z0-9]+/)?.[0] ?? '';

  const htmlTag = text.match(/<iframe[\s\S]*?<\/iframe>/i)?.[0] ?? '';

  let imageUrl =
    text.match(
      /https:\/\/[\w.-]*coupangcdn\.com\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp)/i,
    )?.[0] ?? '';
  // 썸네일 해상도를 카드 표시에 맞게 올린다 (212x212ex -> 492x492ex)
  if (imageUrl) imageUrl = imageUrl.replace(/\/\d+x\d+ex\//, '/492x492ex/');

  return { coupangUrl, imageUrl, htmlTag };
}

/** mm 문자열("가로 506 × 세로 695 × 폭 506") 또는 cm 숫자를 cm 으로 정규화 */
export function toCm(raw: string): number | null {
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  // 200 이상이면 mm 로 입력한 것으로 보고 cm 으로 환산
  return n >= 200 ? Math.round((n / 10) * 10) / 10 : Math.round(n * 10) / 10;
}

export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  refrigerator: 'ref',
  washing_machine: 'wsh',
  dryer: 'dry',
  microwave: 'mic',
  desk: 'dsk',
  shelf: 'shf',
  bed: 'bed',
  hanger: 'hng',
};

/** 같은 카테고리에서 겹치지 않는 다음 id 를 만든다 */
export function nextId(list: Product[], category: CategoryId): string {
  const prefix = CATEGORY_PREFIX[category];
  const used = list
    .filter((p) => p.id.startsWith(`${prefix}-`))
    .map((p) => Number(p.id.slice(prefix.length + 1)))
    .filter(Number.isFinite);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/** products.json 스키마에 맞는 필드만 남긴다 (메모·HTML 태그는 제외) */
export function toProductJson(list: Product[]): string {
  const clean = list.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    brand: p.brand,
    dimensions: p.dimensions,
    capacity_or_spec: p.capacity_or_spec,
    imageUrl: p.imageUrl,
    coupangUrl: p.coupangUrl,
    tags: p.tags,
    verified: p.verified,
  }));
  return JSON.stringify(clean, null, 2);
}

export function hasDeepLink(p: Product): boolean {
  return p.coupangUrl.includes('link.coupang.com/a/');
}
