/**
 * 공개 카탈로그 = VERIFIED + REVIEW (순수 함수).
 *
 * - VERIFIED: 제조사·상세페이지로 W/D/H 를 확인한 Product. 공간 맞춤 필터·추천에 들어간다.
 * - REVIEW:   실제 쿠팡 상품이지만 치수를 확인하기 전. 이름·이미지·가격·카테고리만 공개하고
 *             dimensions 는 아예 없다. filterProducts · fit 계산에는 절대 넣지 않는다.
 *
 * REVIEW 는 Search 결과에 실제로 있던 필드만 옮긴다. 제목에서 치수를 뽑거나
 * productId · itemId · vendorItemId 를 만들지 않는다.
 *
 * Node 테스트가 직접 import 하므로 경로 별칭·JSON import 를 쓰지 않는다.
 */
import type { CategoryId, PendingProduct, Product } from './types';

/** REVIEW 후보의 출처. web_index 는 공개 상품 페이지에서 pageKey 만 확인한 것(추적값 없음) */
export type ReviewSource = 'coupang_search' | 'coupang_web_index';

/** REVIEW 후보를 만드는 저장 기록(pending-*.json · review-candidates.json) */
export interface ReviewSourceRecord {
  productId?: number | string | null;
  name?: string;
  category?: string;
  brand?: string;
  imageUrl?: string;
  coupangUrl?: string;
  price?: number;
  priceCheckedAt?: string;
  keyword?: string;
  collectedAt?: string;
  source?: string;
  sourceUrl?: string;
}

const CATEGORY_IDS: readonly CategoryId[] = [
  'refrigerator',
  'washing_machine',
  'dryer',
  'microwave',
  'desk',
  'shelf',
  'bed',
  'hanger',
  'niche',
  'sofa',
  'dishwasher',
  'folding_table',
  'shoe_rack',
];

export interface ReviewCandidate {
  status: 'review';
  /** 쿠팡 상품 번호(= pageKey). 저장된 값 그대로 */
  productId: number;
  name: string;
  category: CategoryId;
  brand: string;
  imageUrl: string;
  /** 저장된 원문 URL(없으면 빈 값). 화면은 이 값을 링크로 쓰지 않고 CTA resolver 만 거친다 */
  coupangUrl: string;
  /** web_index 의 확인 출처 페이지. 링크로 쓰지 않는다 */
  sourceUrl?: string;
  price?: number;
  priceCheckedAt?: string;
  source: ReviewSource;
  keyword?: string;
  collectedAt?: string;
}

export interface PublicCatalog {
  /** fit 대상. 같은 쿠팡 productId 는 한 장만 남긴다(productId 없는 seed 는 그대로 둔다) */
  verified: Product[];
  review: ReviewCandidate[];
  /** 서로 다른 쿠팡 productId 수 (verified 는 productKey 를 알 수 있는 것만 센다) */
  uniqueProductIds: number;
  /** 같은 productId 라서 공개 verified 에서 뺀 카드 */
  duplicateVerified: VerifiedDuplicate[];
}

/** productId 중복으로 공개 verified 에서 빠진 카드와 대신 남은 카드 */
export interface VerifiedDuplicate {
  id: string;
  productId: number;
  keptId: string;
}

/** 공개 목표 — unique productId 1,000개가 센치픽 1차 완료 기준 (100 은 중간 이정표) */
export const PUBLIC_CATALOG_TARGET = 1000;

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * 카테고리 본체 확인 규칙. 저장된 category 값만 믿지 않고 상품명이 그 카테고리의
 * 본체 상품인지 본다(fail-closed).
 * - require: 상품명에 본체를 가리키는 말이 하나도 없으면 제외
 * - reject:  액세서리 · 소모품 · 부품 · 다른 가전 · 혼합세트 · 차량용이면 제외
 * 애매하면 통과시키지 않는다. 사람이 확인한 예외는 REVIEW_IDENTITY_ALLOWLIST 에만 둔다.
 */
interface CategoryIdentityRule {
  require: RegExp;
  reject: RegExp[];
}

// '랙' 은 색상 '블랙' 과 겹치므로 (?<!블) 로 거른다
const COMMON_REJECT: RegExp[] = [/차량용|자동차|시거잭/, /액세서리|부속품|부품|교체용|리필/];

export const CATEGORY_IDENTITY_RULES: Record<CategoryId, CategoryIdentityRule> = {
  refrigerator: {
    require: /냉장고/,
    reject: [/캠핑|화장품/, /냉온장고/, /전자레인지|전자렌지|인덕션|올인원|세트/, /정리함|정리용기|수납함|탈취|커버|선반|매트|스티커|필터/],
  },
  washing_machine: {
    require: /세탁기/,
    reject: [/세제|세정제|클리너|세탁조/, /러그|매트|받침대|거치대|수평/, /호스|커버|필터/],
  },
  dryer: {
    require: /건조기/,
    // 신발 건조기는 의류 건조기를 함께 표기하지 않은 경우만 제외
    reject: [/^(?!.*의류).*신발\s?건조기/, /식기|음식물|헤어|핸드|손\s?건조/, /건조대|시트|건조볼|배기|호스|필터|커버|받침|선반/, /세탁기/],
  },
  dishwasher: {
    require: /식기세척기/,
    reject: [/수저통|건조대|(?<!블)랙|바스켓/, /세제|린스|세정제|태블릿|필터|호스|커버|받침|선반/],
  },
  microwave: {
    require: /전자레인지|전자렌지/,
    reject: [/전자레인지\s?장|렌지대|선반|수납장|거치대|커버|(?<!블)랙|받침|정리대/, /냉장고|인덕션|올인원/, /용기|찜기/],
  },
  desk: {
    require: /책상|데스크/,
    reject: [/의자|가림막|칸막이|매트|커버|모니터\s?받침|스탠드/],
  },
  shelf: {
    require: /선반|책장|(?<!블)랙|수납장|진열장/,
    reject: [/브라켓|선반\s?받침|커버/],
  },
  bed: {
    require: /침대|베드|평상/,
    reject: [/침대\s?커버|매트리스\s?커버|커버\s?단품|토퍼|패드|이불|베개|가드|사다리|협탁/],
  },
  hanger: {
    require: /행거/,
    reject: [/커버|연결|브라켓|봉\s?단품|바퀴\s?단품|고정\s?핀/],
  },
  niche: {
    require: /틈새|코너/,
    reject: [/커버|스티커/],
  },
  sofa: {
    require: /소파|쇼파/,
    reject: [/커버|패드|방석|다리|테이블/],
  },
  folding_table: {
    // 이름에 접이식 · 폴딩 표기가 없으면 접이식인지 알 수 없으므로 제외
    require: /(?=.*(접이식|폴딩|접는))(?=.*(테이블|식탁|탁자))/,
    reject: [/의자|커버|식탁보|매트/],
  },
  shoe_rack: {
    require: /신발장|신발\s?정리|신발\s?수납|신발\s?랙/,
    reject: [/거치대|신발\s?걸이|자석|탈취|건조기|깔창/],
  },
};

/** QA 가 상품 페이지로 확인한 예외 통과 productId. 근거 없이 추가하지 않는다 */
export const REVIEW_IDENTITY_ALLOWLIST: Readonly<Record<string, string>> = Object.freeze({});

/** QA 가 본체 아님으로 확정한 productId. 이름이 바뀌어도 다시 들어오지 않는다 */
export const REVIEW_IDENTITY_DENYLIST: Readonly<Record<string, string>> = Object.freeze({
  '8763219111': 'refrigerator — 전자레인지 · 인덕션 혼합 세트',
  '9725295650': 'refrigerator — 차량 · 캠핑 · 화장품용 4L 냉온장고',
  '7867973739': 'washing_machine — 의류 건조기',
  '9052797062': 'washing_machine — 미니 건조기',
  '8700854258': 'washing_machine — 세제',
  '8778410758': 'washing_machine — 러그',
  '7219542646': 'dishwasher — 수저통 액세서리',
  '9738898746': 'shoe_rack — 자석식 신발 거치대 액세서리',
});

/**
 * 상품명이 저장 category 의 본체 상품인지. 아니면 제외 사유, 맞으면 null.
 * 규칙이 없는 category 는 통과시키지 않는다.
 */
export function categoryIdentityRejection(productId: number, name: string, category: CategoryId): string | null {
  const key = String(productId);
  if (Object.prototype.hasOwnProperty.call(REVIEW_IDENTITY_DENYLIST, key)) return `QA 제외: ${REVIEW_IDENTITY_DENYLIST[key]}`;
  if (Object.prototype.hasOwnProperty.call(REVIEW_IDENTITY_ALLOWLIST, key)) return null;
  const rule = Object.prototype.hasOwnProperty.call(CATEGORY_IDENTITY_RULES, category) ? CATEGORY_IDENTITY_RULES[category] : undefined;
  if (!rule) return `${category}: 본체 확인 규칙 없음`;
  if (!rule.require.test(name)) return `${category}: 상품명에 본체 표기 없음`;
  const hit = [...COMMON_REJECT, ...rule.reject].map((re) => name.match(re)).find(Boolean);
  if (hit) return `${category}: 본체 아님 (${hit[0]})`;
  return null;
}

/** 공개 REVIEW 카드에 쓸 수 있는 이미지(https URL)가 있는지 */
export function hasPublicImage(imageUrl: unknown): imageUrl is string {
  return nonEmpty(imageUrl) && /^https:\/\/[^\s]+$/.test(imageUrl.trim());
}

/**
 * 수집 기록 1건 → REVIEW 후보. 필수 값이 없거나 카테고리 본체 확인을 통과하지 못하면 null.
 * 허용 목록에 있는 필드만 복사한다(dimensions · dimensionCandidate 등은 따라오지 않는다).
 */
export function toReviewCandidate(record: ReviewSourceRecord | PendingProduct): ReviewCandidate | null {
  if (!record || typeof record !== 'object') return null;
  const productId = Number(record.productId);
  if (!isPositiveInt(productId) || String(productId) !== String(record.productId)) return null;
  if (!nonEmpty(record.name) || !nonEmpty(record.category)) return null;
  const category = record.category as CategoryId;
  if (!CATEGORY_IDS.includes(category)) return null;
  if (categoryIdentityRejection(productId, record.name.trim(), category) !== null) return null;
  // 이미지 없는 카드는 공개하지 않는다. 다른 상품 · 다른 옵션 이미지로 채우지 않는다
  if (!hasPublicImage(record.imageUrl)) return null;

  const raw = record as ReviewSourceRecord;
  const source: ReviewSource = raw.source === 'coupang_web_index' ? 'coupang_web_index' : 'coupang_search';
  const candidate: ReviewCandidate = {
    status: 'review',
    productId,
    name: record.name.trim(),
    category,
    brand: typeof record.brand === 'string' ? record.brand.trim() : '',
    imageUrl: record.imageUrl.trim(),
    // web_index 는 추적 링크가 없다. 저장 URL 이 있어도 넘기지 않는다
    coupangUrl: source === 'coupang_search' && typeof record.coupangUrl === 'string' ? record.coupangUrl : '',
    source,
  };
  if (source === 'coupang_web_index' && nonEmpty(raw.sourceUrl)) candidate.sourceUrl = raw.sourceUrl;
  if (isPositiveInt(record.price)) candidate.price = record.price;
  if (nonEmpty(record.priceCheckedAt)) candidate.priceCheckedAt = record.priceCheckedAt;
  if (nonEmpty(record.keyword)) candidate.keyword = record.keyword;
  if (nonEmpty(record.collectedAt)) candidate.collectedAt = record.collectedAt;
  return candidate;
}

/**
 * verified 상품의 쿠팡 productId. 저장된 productId 가 우선이고,
 * 없으면 명시적 seed provenance 의 pageKey(seedPageKeys) 만 인정한다. 추측하지 않는다.
 */
export function verifiedProductKey(
  product: Product,
  seedPageKeys: Record<string, string> = {},
): number | null {
  if (isPositiveInt(product.productId)) return product.productId;
  const seeded = Object.prototype.hasOwnProperty.call(seedPageKeys, product.id)
    ? Number(seedPageKeys[product.id])
    : NaN;
  return isPositiveInt(seeded) ? seeded : null;
}

/**
 * verified 카드를 쿠팡 productId(pageKey) 기준으로 한 장씩만 남긴다. 내부 id 는 기준이 아니다.
 * - 같은 productId 가 여럿이면 seed provenance(seedPageKeys 에 id 가 있는 카드)를 남긴다.
 *   seed 카드는 저장소에 제조사 치수와 CTA seed identity 가 고정돼 있어 출처를 잃지 않는다.
 * - seed 끼리 · DB 끼리 겹치면 먼저 온 카드를 남긴다.
 * - productId 를 알 수 없는 카드(dry-008 등)는 중복 판단 없이 그대로 둔다.
 * 남은 카드의 순서는 입력 순서를 따른다.
 */
export function dedupeVerifiedByProductKey(
  products: Product[],
  seedPageKeys: Record<string, string> = {},
): { kept: Product[]; duplicates: VerifiedDuplicate[] } {
  const isSeed = (product: Product) => Object.prototype.hasOwnProperty.call(seedPageKeys, product.id);
  const owner = new Map<number, Product>();
  for (const pass of [true, false]) {
    for (const product of products) {
      if (isSeed(product) !== pass) continue;
      const key = verifiedProductKey(product, seedPageKeys);
      if (key !== null && !owner.has(key)) owner.set(key, product);
    }
  }

  const kept: Product[] = [];
  const duplicates: VerifiedDuplicate[] = [];
  for (const product of products) {
    const key = verifiedProductKey(product, seedPageKeys);
    const winner = key === null ? product : owner.get(key);
    if (winner === product) kept.push(product);
    else if (key !== null && winner) duplicates.push({ id: product.id, productId: key, keptId: winner.id });
  }
  return { kept, duplicates };
}

/**
 * VERIFIED 와 REVIEW 를 나눠 공개 카탈로그를 만든다.
 * - verified 에는 verified=true 인 Product 만, productId 기준 한 장씩 남는다(REVIEW 는 절대 섞이지 않는다).
 * - REVIEW 는 productId 기준으로 한 번만, verified 에 이미 있는 productId 는 뺀다.
 */
export function buildPublicCatalog(
  verifiedProducts: Product[],
  records: ReadonlyArray<ReviewSourceRecord | PendingProduct>,
  seedPageKeys: Record<string, string> = {},
): PublicCatalog {
  const { kept: verified, duplicates: duplicateVerified } = dedupeVerifiedByProductKey(
    verifiedProducts.filter((product) => product.verified === true),
    seedPageKeys,
  );
  const seen = new Set<number>();
  for (const product of verified) {
    const key = verifiedProductKey(product, seedPageKeys);
    if (key !== null) seen.add(key);
  }

  const review: ReviewCandidate[] = [];
  for (const record of records) {
    const candidate = toReviewCandidate(record);
    if (!candidate || seen.has(candidate.productId)) continue;
    seen.add(candidate.productId);
    review.push(candidate);
  }

  return { verified, review, uniqueProductIds: seen.size, duplicateVerified };
}

/** 카테고리 탭 하나에 해당하는 REVIEW 후보 (치수 조건은 쓰지 않는다) */
export function reviewForCategories(
  review: ReviewCandidate[],
  allowed: readonly CategoryId[] | null | undefined,
): ReviewCandidate[] {
  if (!allowed) return review;
  return review.filter((candidate) => allowed.includes(candidate.category));
}

/**
 * 카테고리에 보이는 공개 카드 수(verified + review). productId 없는 실측 카드도 센다.
 * 화면 분기(이 카테고리에 verified 가 있는지 등)에만 쓴다. 탭 숫자는 uniqueProductIdsFor 를 쓴다.
 */
export function publicCountFor(
  catalog: Pick<PublicCatalog, 'verified' | 'review'>,
  allowed: readonly CategoryId[] | null | undefined,
): number {
  const inCategory = (category: CategoryId) => !allowed || allowed.includes(category);
  return (
    catalog.verified.filter((product) => inCategory(product.category)).length +
    catalog.review.filter((candidate) => inCategory(candidate.category)).length
  );
}

/** 1,000개 전에 모든 공개 카테고리 탭이 갖춰야 할 최소 고유 productId 수 */
export const MIN_PUBLIC_PER_CATEGORY = 10;

/**
 * 카테고리(탭) 하나의 공개 고유상품 수 = 서로 다른 쿠팡 productId 수.
 * 홈 탭 숫자 · catalog:gate 가 쓰는 기준. verified 는 productKey 를 아는 것만 센다.
 */
export function uniqueProductIdsFor(
  catalog: Pick<PublicCatalog, 'verified' | 'review'>,
  allowed: readonly CategoryId[] | null | undefined,
  seedPageKeys: Record<string, string> = {},
): number {
  const inCategory = (category: CategoryId) => !allowed || allowed.includes(category);
  const ids = new Set<number>();
  for (const product of catalog.verified) {
    if (!inCategory(product.category)) continue;
    const key = verifiedProductKey(product, seedPageKeys);
    if (key !== null) ids.add(key);
  }
  for (const candidate of catalog.review) {
    if (inCategory(candidate.category)) ids.add(candidate.productId);
  }
  return ids.size;
}

/**
 * 관리자 상단 통계. 세 숫자는 의미가 서로 다르다.
 * - fitTargets: 공간 맞춤(fit)에 들어가는 공개 verified 카드 수 (productId 중복 제거 후, productId 없는 실측 seed 포함)
 * - review: 치수 확인 전 공개 REVIEW 후보 수
 * - uniqueProductIds: 공개 고유상품 = verified + review 의 서로 다른 쿠팡 productId 수 (1,000 목표 기준)
 */
export interface PublicCatalogStats {
  fitTargets: number;
  review: number;
  uniqueProductIds: number;
}

export function publicCatalogStats(catalog: PublicCatalog): PublicCatalogStats {
  return {
    fitTargets: catalog.verified.length,
    review: catalog.review.length,
    uniqueProductIds: catalog.uniqueProductIds,
  };
}

/** 최소 기준(MIN_PUBLIC_PER_CATEGORY)에 못 미치는 탭 목록. 적은 순 */
export function categoryShortfalls(
  catalog: Pick<PublicCatalog, 'verified' | 'review'>,
  tabs: ReadonlyArray<{ id: string; allowed: readonly CategoryId[] | null }>,
  seedPageKeys: Record<string, string> = {},
  min: number = MIN_PUBLIC_PER_CATEGORY,
): Array<{ id: string; count: number }> {
  return tabs
    .map((tab) => ({ id: tab.id, count: uniqueProductIdsFor(catalog, tab.allowed, seedPageKeys) }))
    .filter((row) => row.count < min)
    .sort((a, b) => a.count - b.count || a.id.localeCompare(b.id));
}
