import provenance from '@/data/coupang-cta-provenance.json';
import {
  resolveCoupangTrackedHref,
  type CoupangCtaProduct,
  type CoupangCtaRegistry,
} from './coupangCta';

/**
 * 저장된 exact identity + 추적값.
 * - seedById: 제조사·상세페이지로 모델·옵션까지 확인한 seed
 * - landingByProductId: 중앙 affiliate registry 에 저장된 Deep Link landing 값 (생성·추측 금지)
 */
export const COUPANG_CTA_PROVENANCE = provenance as CoupangCtaRegistry;

/** 공개 ProductCard · ProductDetail 이 쓰는 쿠팡 CTA href. 없으면 null */
export function coupangCtaHref(product: CoupangCtaProduct): string | null {
  return resolveCoupangTrackedHref(product, COUPANG_CTA_PROVENANCE);
}
