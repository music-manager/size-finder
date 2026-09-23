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
  /** "480*400*560" 처럼 본문에 적힌 치수 (cm 로 환산된 문자열) */
  width: string;
  depth: string;
  height: string;
  capacity_or_spec: string;
  tags: string;
}

/** 본문 단어로 자동으로 붙이는 태그. 앞에 있는 것부터 최대 4개. */
const TAG_HINTS: [RegExp, string][] = [
  [/로켓\s*배송|로켓와우/, '로켓배송'],
  [/로켓\s*설치/, '로켓설치'],
  [/무설치/, '무설치'],
  [/고객\s*직접\s*설치|직접\s*설치/, '직접설치'],
  [/설치\s*불필요/, '설치불필요'],
  [/인버터/, '인버터'],
  [/저소음|정숙/, '저소음'],
  [/히트\s*펌프/, '히트펌프'],
  [/1등급|일등급/, '1등급'],
  [/벽걸이/, '벽걸이'],
  [/접이식|폴딩/, '접이식'],
  [/초슬림|슬림/, '슬림'],
  [/틈새/, '틈새수납'],
  [/바퀴|이동식/, '바퀴형'],
  [/대용량/, '대용량'],
  [/1인\s*가구|원룸|자취/, '원룸추천'],
];

function pickTags(text: string): string[] {
  const hit: string[] = [];
  for (const [re, tag] of TAG_HINTS) {
    if (hit.length >= 4) break;
    if (re.test(text) && !hit.includes(tag)) hit.push(tag);
  }
  return hit;
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

  // "480*400*560", "520 x 434 x 640mm", "52×43.4×64cm" 등을 치수로 인식한다
  const dimMatch = rest.match(
    /(\d{1,4}(?:\.\d+)?)\s*(?:mm|cm)?\s*[x*×✕X]\s*(\d{1,4}(?:\.\d+)?)\s*(?:mm|cm)?\s*[x*×✕X]\s*(\d{1,4}(?:\.\d+)?)\s*(mm|cm)?/i,
  );
  const unit = dimMatch?.[4]?.toLowerCase();
  const asCm = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return '';
    // 단위가 적혀 있으면 그대로 따르고, 없으면 200 이상을 mm 로 본다
    const cm = unit === 'mm' || (!unit && n >= 200) ? n / 10 : n;
    return String(Math.round(cm * 10) / 10);
  };
  const width = dimMatch ? asCm(dimMatch[1]) : '';
  const depth = dimMatch ? asCm(dimMatch[2]) : '';
  const height = dimMatch ? asCm(dimMatch[3]) : '';

  // 가격과 치수 표기는 제품명에서 걷어낸다 (제목에 그대로 붙던 문제)
  let name = rest;
  if (priceMatch) name = name.replace(priceMatch[0], ' ');
  if (dimMatch) name = name.replace(dimMatch[0], ' ');
  name = name.replace(/\s+/g, ' ').trim().slice(0, 80);

  // 한국 상품명은 보통 브랜드가 맨 앞에 온다
  const brand = name ? (name.split(' ')[0] ?? '') : '';

  // 용량(2.5kg / 86L / 6인용 / 3단) 과 모델코드(MDD02A25/WB-KR) 를 스펙으로 묶는다
  const capacity = name.match(
    /\d+(?:\.\d+)?\s*(?:kg|KG|Kg|L|ℓ|리터|인용|인|단)\b/,
  )?.[0];
  const modelCode = name.match(
    /\b[A-Z][A-Z0-9]{2,}(?:[-/][A-Z0-9]+)*\b/,
  )?.[0];
  const capacity_or_spec = [capacity, modelCode].filter(Boolean).join(' · ');

  return {
    coupangUrl,
    imageUrl,
    htmlTag,
    name,
    brand,
    price,
    category: guessCategory(name),
    width,
    depth,
    height,
    capacity_or_spec,
    tags: pickTags(rest).join(', '),
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
    // 자동 수집분의 재수집·가격 갱신 기준이므로 반드시 함께 내보낸다
    ...(p.productId ? { productId: p.productId } : {}),
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

/** 쿠팡 파트너스의 구형 단축 링크와 Search API의 AFFSDP 딥링크를 모두 인정한다. */
export function hasDeepLink(p: Product): boolean {
  return /^https:\/\/link\.coupang\.com\/(?:a\/|re\/AFFSDP(?:\?|$))/i.test(p.coupangUrl);
}
