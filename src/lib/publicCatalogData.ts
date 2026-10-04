import reviewCandidateRecords from '@/data/review-candidates.json';
import verifiedBatchRows from '@/data/verified-batch-44.json';
import { COUPANG_CTA_PROVENANCE } from './coupangCtaLinks';
import { pendingProducts } from './products';
import {
  buildPublicCatalog,
  verifiedProductKey,
  type PublicCatalog,
  type ReviewSourceRecord,
} from './publicCatalog';
import type { Product } from './types';
import {
  appendVerifiedBatch,
  buildVerifiedBatchProducts,
  type VerifiedBatchRow,
  type VerifiedBatchSourceRecord,
} from './verifiedBatch';

/** seed verified 상품의 productKey 는 명시적 seed provenance 의 pageKey 만 인정한다 */
export const SEED_PAGE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(COUPANG_CTA_PROVENANCE.seedById ?? {}).map(([id, identity]) => [
    id,
    identity.pageKey,
  ]),
);

/** Issue #44 수동 치수검증 배치. 치수는 manifest, 이름 · 이미지 · URL 은 같은 productId 의 저장 기록 */
export const VERIFIED_BATCH_PRODUCTS: Product[] = buildVerifiedBatchProducts(
  verifiedBatchRows as VerifiedBatchRow[],
  reviewCandidateRecords as VerifiedBatchSourceRecord[],
);

/** 운영 DB · seed verified 뒤에 배치 상품을 붙인다. 같은 productId 가 이미 있으면 기존 것을 남긴다 */
export function withVerifiedBatch(products: Product[]): Product[] {
  return appendVerifiedBatch(products, VERIFIED_BATCH_PRODUCTS, (product) =>
    verifiedProductKey(product, SEED_PAGE_KEYS),
  );
}

/**
 * 공개 카탈로그. REVIEW 후보는 저장소에 저장된 기록에서만 만든다.
 *   - pending-*.json: Coupang Search 실수집
 *   - review-candidates.json: 중앙 Search cache · 공개 상품 페이지에서 productId 를 확인한 상품
 * verified(라이브 카탈로그)에 이미 있는 productId 는 REVIEW 에서 빠진다.
 */
export function getPublicCatalog(verifiedProducts: Product[]): PublicCatalog {
  const records: ReviewSourceRecord[] = [
    ...pendingProducts,
    ...(reviewCandidateRecords as ReviewSourceRecord[]),
  ];
  return buildPublicCatalog(withVerifiedBatch(verifiedProducts), records, SEED_PAGE_KEYS);
}
