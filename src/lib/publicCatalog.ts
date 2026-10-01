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

export interface ReviewCandidate {
  status: 'review';
  /** 쿠팡 상품 번호(= pageKey). 저장된 값 그대로 */
  productId: number;
  name: string;
  category: CategoryId;
  brand: string;
  imageUrl: string;
  /** 저장된 원문 URL. 화면은 이 값을 링크로 쓰지 않고 CTA resolver 만 거친다 */
  coupangUrl: string;
  price?: number;
  priceCheckedAt?: string;
  source: 'coupang_search';
  keyword?: string;
  collectedAt?: string;
}

export interface PublicCatalog {
  verified: Product[];
  review: ReviewCandidate[];
  /** 서로 다른 쿠팡 productId 수 (verified 는 productKey 를 알 수 있는 것만 센다) */
  uniqueProductIds: number;
}

/** 공개 목표 — 1차 완료 기준 */
export const PUBLIC_CATALOG_TARGET = 100;

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * 수집 기록 1건 → REVIEW 후보. 필수 값이 없으면 null.
 * 허용 목록에 있는 필드만 복사한다(dimensions · dimensionCandidate 등은 따라오지 않는다).
 */
export function toReviewCandidate(record: PendingProduct): ReviewCandidate | null {
  if (!record || typeof record !== 'object') return null;
  const productId = Number(record.productId);
  if (!isPositiveInt(productId) || String(productId) !== String(record.productId)) return null;
  if (!nonEmpty(record.name) || !nonEmpty(record.category) || !nonEmpty(record.coupangUrl)) return null;

  const candidate: ReviewCandidate = {
    status: 'review',
    productId,
    name: record.name.trim(),
    category: record.category,
    brand: typeof record.brand === 'string' ? record.brand.trim() : '',
    imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : '',
    coupangUrl: record.coupangUrl,
    source: 'coupang_search',
  };
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
 * VERIFIED 와 REVIEW 를 나눠 공개 카탈로그를 만든다.
 * - verified 에는 verified=true 인 Product 만 남는다(REVIEW 는 절대 섞이지 않는다).
 * - REVIEW 는 productId 기준으로 한 번만, verified 에 이미 있는 productId 는 뺀다.
 */
export function buildPublicCatalog(
  verifiedProducts: Product[],
  records: PendingProduct[],
  seedPageKeys: Record<string, string> = {},
): PublicCatalog {
  const verified = verifiedProducts.filter((product) => product.verified === true);
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

  return { verified, review, uniqueProductIds: seen.size };
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
 * 카테고리 탭 숫자 = 그 카테고리의 공개 상품 총수(verified + review).
 * 공간 맞춤 결과 수(verified 를 치수로 거른 수)와는 의미가 다르다.
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
