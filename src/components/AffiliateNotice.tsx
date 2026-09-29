import { AFFILIATE_NOTICE } from '@/lib/siteInfo';

/**
 * 쿠팡 파트너스 경제적 이해관계 고지 — 상품 목록 / 쿠팡 CTA 바로 위, 섹션 단위 1회.
 *
 * 문구는 siteInfo 의 AFFILIATE_NOTICE 하나만 쓴다(하드코딩 금지).
 * 상품 카드마다 반복하지 않는다. 숨기지 않는다(aria-hidden · hidden 금지).
 * 푸터 고지는 보조로 그대로 둔다.
 */
export default function AffiliateNotice({ className = '' }: { className?: string }) {
  return (
    <p
      role="note"
      className={`rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-semibold leading-relaxed text-brand-900 [overflow-wrap:anywhere] [word-break:keep-all] sm:px-4 sm:py-3 sm:text-[15px] ${className}`.trim()}
    >
      {AFFILIATE_NOTICE}
    </p>
  );
}
