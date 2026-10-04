/**
 * 수동 치수검증 배치(Issue #44) → 공개 VERIFIED 상품 (순수 함수).
 *
 * - 치수는 manifest(src/data/verified-batch-44.json)에 기록된 검증값만 쓴다. 추정하지 않는다.
 * - 이름 · 이미지 · 가격 · 저장 URL 은 같은 productId 의 REVIEW 저장 기록에서 그대로 가져온다.
 * - CTA 는 새로 만들지 않는다.
 *   - cta=keep_existing: 지금 공개 REVIEW 카드가 쓰는 저장 URL 을 그대로 둔다(같은 resolver → 같은 href).
 *   - cta=none: 지금 공개 CTA 가 없던 상품. coupangUrl 을 비워 '구매 링크 검증 중'으로 둔다.
 * - 운영 DB · seed 에 같은 productId 의 verified 가 이미 있으면 그쪽을 남기고 배치 상품은 붙이지 않는다.
 *
 * Node 테스트가 직접 import 하므로 경로 별칭 · JSON import 를 쓰지 않는다.
 */
import type { CategoryId, Product } from './types';

export interface VerifiedBatchRow {
  productId: number;
  category: CategoryId;
  model?: string | null;
  option?: string | null;
  itemId: string;
  vendorItemId: string;
  sourceDimensions: string;
  dimensions: { width: number; depth: number; height: number };
  cta: 'keep_existing' | 'none';
  provenance: { source: string; issue: number; entry: number; commentId?: number | null };
  installReference?: string;
}

export interface VerifiedBatchSourceRecord {
  productId?: number | string | null;
  name?: string;
  category?: string;
  brand?: string;
  imageUrl?: string;
  coupangUrl?: string;
  itemId?: string;
  vendorItemId?: string;
  price?: number;
  priceCheckedAt?: string;
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * manifest 행 하나를 VERIFIED Product 로. 근거가 맞지 않으면 null(fail-closed).
 * - 같은 productId 의 저장 기록이 있어야 하고 category · itemId · vendorItemId 가 같아야 한다.
 * - W/D/H 는 모두 0 보다 커야 한다.
 */
export function toVerifiedBatchProduct(
  row: VerifiedBatchRow,
  record: VerifiedBatchSourceRecord | undefined,
): Product | null {
  if (!record || Number(record.productId) !== row.productId) return null;
  if (record.category !== row.category) return null;
  if (String(record.itemId) !== row.itemId || String(record.vendorItemId) !== row.vendorItemId) return null;
  const { width, depth, height } = row.dimensions ?? ({} as VerifiedBatchRow['dimensions']);
  if (!positive(width) || !positive(depth) || !positive(height)) return null;
  if (typeof record.name !== 'string' || record.name.trim() === '') return null;

  const spec = [row.model ? `모델 ${row.model}` : '', row.option ? `옵션 ${row.option}` : '']
    .filter(Boolean)
    .join(' · ');

  return {
    id: `cp-${row.productId}`,
    name: record.name.trim(),
    category: row.category,
    brand: typeof record.brand === 'string' ? record.brand : '',
    dimensions: { width, depth, height },
    capacity_or_spec: spec,
    imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : '',
    coupangUrl: row.cta === 'keep_existing' && typeof record.coupangUrl === 'string' ? record.coupangUrl : '',
    tags: [],
    verified: true,
    ...(positive(record.price) ? { price: record.price } : {}),
    ...(typeof record.priceCheckedAt === 'string' && record.priceCheckedAt ? { priceCheckedAt: record.priceCheckedAt } : {}),
    productId: row.productId,
  };
}

/** manifest 전체 → VERIFIED Product 목록 (근거가 맞지 않는 행은 빠진다) */
export function buildVerifiedBatchProducts(
  rows: ReadonlyArray<VerifiedBatchRow>,
  records: ReadonlyArray<VerifiedBatchSourceRecord>,
): Product[] {
  const byId = new Map<number, VerifiedBatchSourceRecord>();
  for (const record of records) {
    const key = Number(record.productId);
    if (Number.isSafeInteger(key) && !byId.has(key)) byId.set(key, record);
  }
  const out: Product[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.productId)) continue;
    const product = toVerifiedBatchProduct(row, byId.get(row.productId));
    if (!product) continue;
    seen.add(row.productId);
    out.push(product);
  }
  return out;
}

/**
 * 기존 verified 목록 뒤에 배치 상품을 붙인다.
 * 이미 같은 productId 의 verified(운영 DB · seed)가 있으면 배치 상품은 건너뛴다.
 * keyOf 는 verifiedProductKey(product, SEED_PAGE_KEYS) 처럼 productId 를 돌려준다.
 */
export function appendVerifiedBatch(
  products: Product[],
  batch: ReadonlyArray<Product>,
  keyOf: (product: Product) => number | null,
): Product[] {
  const present = new Set<number>();
  for (const product of products) {
    if (product.verified !== true) continue;
    const key = keyOf(product);
    if (key !== null) present.add(key);
  }
  return [...products, ...batch.filter((product) => !present.has(product.productId as number))];
}
