'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BadgeCheck, ChevronRight, Rocket } from 'lucide-react';
import { CATEGORY_LABEL } from '@/lib/categories';
import { formatCm } from '@/lib/products';
import { formatCheckedAt, formatWon } from '@/lib/adminParse';
import type { Product } from '@/lib/types';

interface Props {
  product: Product;
}

/** 태그에서 배지로 승격시킬 항목 — 커머스 관습대로 배송 조건을 가장 먼저 보여준다 */
const ROCKET_TAG = '로켓배송';

export default function ProductCard({ product }: Props) {
  const { width, depth, height } = product.dimensions;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(product.imageUrl) && !imageFailed;

  const isRocket = product.tags.includes(ROCKET_TAG);
  const restTags = product.tags.filter((t) => t !== ROCKET_TAG);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-lg">
      <div className="flex flex-1 flex-col p-3">
        {/* 브랜드 · 카테고리 */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="font-bold text-slate-900">{product.brand}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400">{CATEGORY_LABEL[product.category]}</span>
        </div>

        {/* 썸네일 + 제품명 */}
        <div className="mt-1.5 flex items-start gap-2.5">
          {showImage && (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-white">
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="64px"
                className="object-contain"
                onError={() => setImageFailed(true)}
                unoptimized
              />
            </div>
          )}
          <h3 className="line-clamp-3 text-[13px] font-medium leading-snug text-slate-800">
            {product.name}
          </h3>
        </div>

        {/* 실측 치수 — 이 사이트의 핵심 정보 */}
        <div className="mt-2.5 rounded-lg bg-brand-50 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-brand-500">실측 크기</span>
            {product.verified && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600">
                <BadgeCheck className="h-2.5 w-2.5" aria-hidden="true" />
                스펙 확인
              </span>
            )}
          </div>
          <p className="mt-0.5 whitespace-nowrap text-center text-[13px] font-extrabold tabular-nums text-brand-800">
            {formatCm(width)}
            <span className="text-[10px] font-bold text-brand-400">×</span>
            {formatCm(depth)}
            <span className="text-[10px] font-bold text-brand-400">×</span>
            {formatCm(height)}
            <span className="text-[10px] font-bold text-brand-500">cm</span>
          </p>
          <p className="text-center text-[9px] font-medium text-brand-400">
            가로 × 깊이 × 높이
          </p>
        </div>

        <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-500">
          {product.capacity_or_spec}
        </p>

        {/* 배송 배지 + 태그 */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {isRocket && (
            <span className="inline-flex items-center gap-0.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-600">
              <Rocket className="h-2.5 w-2.5" aria-hidden="true" />
              로켓배송
            </span>
          )}
          {restTags.map((tag) => (
            <span key={tag} className="text-[10px] text-slate-400">
              #{tag}
            </span>
          ))}
        </div>

        {/* 가격 — 커머스 관습대로 가장 강한 시각 요소 */}
        <div className="mt-auto pt-2.5">
          {product.price ? (
            <p className="flex items-baseline gap-1">
              <span className="text-[19px] font-extrabold leading-none tabular-nums text-rose-600">
                {formatWon(product.price)}
              </span>
              <span className="text-sm font-bold text-rose-600">원</span>
              <span className="ml-auto text-[9px] text-slate-400">
                {formatCheckedAt(product.priceCheckedAt)}
              </span>
            </p>
          ) : (
            <p className="text-[11px] font-medium text-slate-400">쿠팡에서 가격 확인</p>
          )}

          <a
            href={product.coupangUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-2 flex items-center justify-center gap-0.5 rounded-lg bg-rose-500 py-2.5 text-[13px] font-bold text-white transition hover:bg-rose-600 active:scale-[0.99]"
          >
            쿠팡에서 보기
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}
