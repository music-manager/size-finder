import { COUPANG_CTA_PROVENANCE } from './coupangCtaLinks';
import { pendingProducts } from './products';
import { buildPublicCatalog, type PublicCatalog } from './publicCatalog';
import type { Product } from './types';

/** seed verified 상품의 productKey 는 명시적 seed provenance 의 pageKey 만 인정한다 */
export const SEED_PAGE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(COUPANG_CTA_PROVENANCE.seedById ?? {}).map(([id, identity]) => [
    id,
    identity.pageKey,
  ]),
);

/**
 * 공개 카탈로그. REVIEW 후보는 저장소에 저장된 실수집 기록(pending-*.json)에서만 만든다.
 * verified(라이브 카탈로그)에 이미 있는 productId 는 REVIEW 에서 빠진다.
 */
export function getPublicCatalog(verifiedProducts: Product[]): PublicCatalog {
  return buildPublicCatalog(verifiedProducts, pendingProducts, SEED_PAGE_KEYS);
}
