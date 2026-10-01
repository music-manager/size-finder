'use client';

import { useState } from 'react';
import { ChevronRight, Ruler } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';
import { CATEGORY_LABEL } from '@/lib/categories';
import { coupangCtaHref } from '@/lib/coupangCtaLinks';
import { formatCheckedAt, formatWon } from '@/lib/adminParse';
import type { ReviewCandidate } from '@/lib/publicCatalog';

interface Props {
  candidate: ReviewCandidate;
}

/**
 * 치수 확인 전 실제 쿠팡 상품 카드.
 * 치수 · 공간 여유는 표시하지 않는다. 외부 링크는 CTA resolver 가 확인한 것만 쓴다.
 */
export default function ReviewCard({ candidate }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(candidate.imageUrl) && !imageFailed;
  // web_index 처럼 추적값이 없는 출처는 resolver 를 거치지 않고 링크를 만들지 않는다
  const coupangHref =
    candidate.source === 'coupang_search'
      ? coupangCtaHref({
          id: `cp-${candidate.productId}`,
          coupangUrl: candidate.coupangUrl,
          productId: candidate.productId,
        })
      : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative block aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-white">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.imageUrl}
            alt={candidate.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-2"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <ImagePlaceholder />
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-[3px] text-[10px] font-bold leading-none text-amber-800 ring-1 ring-inset ring-amber-300">
          <Ruler className="h-2.5 w-2.5" aria-hidden="true" />
          치수 검증 중
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center gap-1.5 text-[11px]">
          {candidate.brand && (
            <>
              <span className="font-bold text-slate-900">{candidate.brand}</span>
              <span className="text-slate-300">|</span>
            </>
          )}
          <span className="text-slate-400">{CATEGORY_LABEL[candidate.category]}</span>
        </div>

        <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-slate-800">
          {candidate.name}
        </h3>

        <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-500">
          가로·깊이·높이 확인 전이라 공간 맞춤 결과에 포함되지 않습니다.
        </p>

        <div className="mt-auto pt-3">
          {candidate.price ? (
            <p className="flex items-baseline gap-1">
              <span className="text-[17px] font-extrabold leading-none tabular-nums text-rose-600">
                {formatWon(candidate.price)}
              </span>
              <span className="text-sm font-bold text-rose-600">원</span>
              <span className="ml-auto text-[9px] text-slate-400">
                {formatCheckedAt(candidate.priceCheckedAt)}
              </span>
            </p>
          ) : (
            <p className="text-[11px] font-medium text-slate-400">쿠팡에서 가격 확인</p>
          )}

          {coupangHref ? (
            <a
              href={coupangHref}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-2 flex items-center justify-center gap-0.5 rounded-lg bg-orange-700 py-2.5 text-[13px] font-bold text-white transition hover:bg-orange-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 active:scale-[0.99]"
            >
              쿠팡에서 보기
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <p className="mt-2 rounded-lg bg-slate-50 py-2.5 text-center text-[13px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200">
              구매 링크 검증 중
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
