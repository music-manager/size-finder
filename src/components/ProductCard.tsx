'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, ChevronRight, Rocket } from 'lucide-react';
import { CATEGORY_EMOJI, CATEGORY_LABEL } from '@/lib/categories';
import {
  DOOR_CLEARANCE_CM,
  formatCm,
  needsDoorClearance,
} from '@/lib/products';
import { formatCheckedAt, formatWon } from '@/lib/adminParse';
import type { Product } from '@/lib/types';

interface Props {
  product: Product;
  /** 도어 개폐 공간 포함 필터가 켜져 있는지 */
  doorClearance?: boolean;
}

/** 태그에서 배지로 승격시킬 항목 — 커머스 관습대로 배송 조건을 가장 먼저 보여준다 */
const ROCKET_TAG = '로켓배송';

export default function ProductCard({ product, doorClearance = false }: Props) {
  const { width, depth, height } = product.dimensions;
  // 큰 썸네일을 먼저 시도하고, 그 해상도가 없는 상품이면 쿠팡이 준 원본으로
  // 되돌아간다. 둘 다 실패해야 플레이스홀더로 넘어간다.
  const sources = useMemo(() => {
    if (!product.imageUrl) return [];
    const upgraded = product.imageUrl.replace(/\/\d+x\d+ex\//, '/492x492ex/');
    return upgraded === product.imageUrl ? [product.imageUrl] : [upgraded, product.imageUrl];
  }, [product.imageUrl]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const imageSrc = sources[sourceIndex];
  const showImage = Boolean(imageSrc);

  const showDoorNote = doorClearance && needsDoorClearance(product);
  const isRocket = product.tags.includes(ROCKET_TAG);
  const restTags = product.tags.filter((t) => t !== ROCKET_TAG);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-lg">
      <Link
        href={`/p/${product.id}`}
        className="relative block aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-white"
        aria-label={`${product.name} 상세 보기`}
      >
        {showImage ? (
          // next/image 는 data: URL 을 거부하므로, 직접 올린 사진은 img 로 그린다
          imageSrc.startsWith('data:') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={imageSrc}
              src={imageSrc}
              alt={product.name}
              className="absolute inset-0 h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.04]"
              onError={() => setSourceIndex((i) => i + 1)}
            />
          ) : (
            <Image
              key={imageSrc}
              src={imageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-2 transition duration-300 group-hover:scale-[1.04]"
              onError={() => setSourceIndex((i) => i + 1)}
              unoptimized
            />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-slate-50 to-slate-100">
            <span className="text-3xl opacity-40" aria-hidden="true">
              {CATEGORY_EMOJI[product.category]}
            </span>
            <span className="text-[9px] font-medium text-slate-300">
              사진 준비 중
            </span>
          </div>
        )}
        {isRocket && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-md bg-sky-500/95 px-1.5 py-[3px] text-[10px] font-bold leading-none text-white">
            <Rocket className="h-2.5 w-2.5" aria-hidden="true" />
            로켓배송
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        {/* 브랜드 · 카테고리 */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="font-bold text-slate-900">{product.brand}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400">{CATEGORY_LABEL[product.category]}</span>
        </div>

        {/* 썸네일 + 제품명 */}
        <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-slate-800">
          <Link href={`/p/${product.id}`} className="hover:text-brand-700 hover:underline">
            {product.name}
          </Link>
        </h3>

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
          {showDoorNote && (
            <p className="mt-1 rounded bg-white/70 py-0.5 text-center text-[9px] font-bold text-brand-700">
              문 열면 깊이 {formatCm(depth + DOOR_CLEARANCE_CM)}cm 필요
            </p>
          )}
        </div>

        <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-500">
          {product.capacity_or_spec}
        </p>

        {/* 배송 배지 + 태그 */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
