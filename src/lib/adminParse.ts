import type { CategoryId, Product } from './types';

/**
 * 관리 툴이 브라우저에 보관하는 레코드.
 * htmlTag 는 쿠팡 배너 코드 보관용이라 products.json 으로는 내보내지 않는다.
 */
export interface AdminRecord extends Product {
  htmlTag?: string;
}

/** 쿠팡 파트너스에서 복사한 덩어리에서 한 번에 뽑아내는 값들 */
export interface ParsedBlob {
  coupangUrl: string;
  imageUrl: string;
  htmlTag: string;
  name: string;
  brand: string;
  price: string;
  category: CategoryId | '';
}

/** 제품명에 들어 있는 단어로 카테고리를 추측한다. 앞에 있는 규칙이 우선. */
const CATEGORY_HINTS: [RegExp, CategoryId][] = [
  [/식기세척기|식세기/, 'dishwasher'],
  [/건조기/, 'dryer'],
  [/세탁기/, 'washing_machine'],
  [/냉장고|김치냉장|냉동고/, 'refrigerator'],
  [/전자레인지|전자렌지|레인지장/, 'microwave'],
  [/신발장|슈즈랙/, 'shoe_rack'],
  [/틈새|트롤리|카트/, 'niche'],
  [/소파|좌식|빈백/, 'sofa'],
  [/침대|매트리스|프레임/, 'bed'],
  [/행거|옷장|드레스룸/, 'hanger'],
  [/밥상|좌탁|접이식\s*테이블|폴딩\s*테이블|트레이/, 'folding_table'],
  [/책상|데스크/, 'desk'],
  [/선반|책장|수납장|협탁/, 'shelf'],
];

export function guessCategory(name: string): CategoryId | '' {
  const hit = CATEGORY_HINTS.find(([re]) => re.test(name));
  return hit ? hit[1] : '';
}

export function parseCoupangBlob(text: string): ParsedBlob {
  const coupangUrl =
    text.match(/https:\/\/link\.coupang\.com\/a\/[A-Za-z0-9]+/)?.[0] ?? '';

  const htmlTag = text.match(/<iframe[\s\S]*?<\/iframe>/i)?.[0] ?? '';

  // 쿠팡이 준 주소를 그대로 저장한다. 해상도 경로를 임의로 바꾸면
  // 그 크기가 없는 상품에서 이미지가 통째로 깨진다.
  // 더 큰 썸네일은 카드에서 시도하고, 실패하면 이 원본으로 되돌아간다.
  const imageUrl =
    text.match(
      /https:\/\/[\w.-]*coupangcdn\.com\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp)/i,
    )?.[0] ?? '';

  // URL 과 HTML 태그를 걷어낸 나머지 텍스트에서 가격과 제품명을 찾는다
  const rest = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "201,270원" 처럼 천단위 구분이 있거나 네 자리 이상인 숫자만 가격으로 본다.
  // (제품명의 "2.5kg", "3단" 같은 숫자를 가격으로 오인하지 않기 위함)
  const priceMatch = rest.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/);
  const price = priceMatch ? priceMatch[1].replace(/,/g, '') : '';

  const name = (priceMatch ? rest.replace(priceMatch[0], ' ') : rest)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  // 한국 상품명은 보통 브랜드가 맨 앞에 온다
  const brand = name ? (name.split(' ')[0] ?? '') : '';

  return {
    coupangUrl,
    imageUrl,
    htmlTag,
    name,
    brand,
    price,
    category: guessCategory(name),
  };
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
  niche: 'nic',
  sofa: 'sfa',
  dishwasher: 'dsh',
  folding_table: 'ftb',
  shoe_rack: 'sho',
};

/** 같은 카테고리에서 겹치지 않는 다음 id 를 만든다 */
export function nextId(list: AdminRecord[], category: CategoryId): string {
  const prefix = CATEGORY_PREFIX[category];
  const used = list
    .filter((p) => p.id.startsWith(`${prefix}-`))
    .map((p) => Number(p.id.slice(prefix.length + 1)))
    .filter(Number.isFinite);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/** products.json 스키마에 맞는 필드만 남긴다 (메모·HTML 태그는 제외) */
export function toProductJson(list: AdminRecord[]): string {
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
    ...(p.price ? { price: p.price, priceCheckedAt: p.priceCheckedAt } : {}),
  }));
  return JSON.stringify(clean, null, 2);
}

/** "139,000" / "139000원" 같은 입력을 숫자로 */
export function toWon(raw: string): number | null {
  const n = Number(String(raw).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatWon(won: number): string {
  return won.toLocaleString('ko-KR');
}

/** 가격 확인일을 'YYYY.MM 기준' 으로 */
export function formatCheckedAt(iso?: string): string {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return y && m ? `${y}.${m} 기준` : '';
}

export function hasDeepLink(p: Product): boolean {
  return p.coupangUrl.includes('link.coupang.com/a/');
}
