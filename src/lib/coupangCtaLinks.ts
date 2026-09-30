import provenance from '@/data/coupang-cta-provenance.json';
import {
  resolveCoupangTrackedHref,
  type CoupangCtaProduct,
  type CoupangCtaRegistry,
} from './coupangCta';

/** 검증된 seed 의 exact identity. 추가는 제조사·상세페이지로 모델·옵션까지 확인한 경우만 */
export const COUPANG_CTA_PROVENANCE = provenance as CoupangCtaRegistry;

/** 공개 ProductCard · ProductDetail 이 쓰는 쿠팡 CTA href. 없으면 null */
export function coupangCtaHref(product: CoupangCtaProduct): string | null {
  return resolveCoupangTrackedHref(product, COUPANG_CTA_PROVENANCE);
}
