'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, ChevronRight, ExternalLink, Rocket } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';
import { CATEGORY_LABEL } from '@/lib/categories';
import { formatCheckedAt, formatWon } from '@/lib/adminParse';
import { formatCm } from '@/lib/products';
import { toSafeCoupangProductUrl } from '@/lib/coupangUrl';
import type { Product } from '@/lib/types';

interface Props {
  product: Product;
}

export default function ProductDetail({ product }: Props) {
  const sources = useMemo(() => {
    if (!product.imageUrl) return [];
    const upgraded = product.imageUrl.replace(/\/\d+x\d+ex\//, '/492x492ex/');
    return upgraded === product.imageUrl ? [product.imageUrl] : [upgraded, product.imageUrl];
  }, [product.imageUrl]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const imageSrc = sources[sourceIndex];
  const isRocket = product.tags.includes('로켓배송');
  const coupangHref = toSafeCoupangProductUrl(product.coupangUrl);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        센치픽으로 돌아가기
      </Link>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="relative min-h-[320px] border-b border-slate-100 bg-white md:border-b-0 md:border-r">
            {imageSrc ? (
              <Image
                key={imageSrc}
                src={imageSrc}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain p-6"
                onError={() => setSourceIndex((i) => i + 1)}
                unoptimized
                priority
              />
            ) : (
              <ImagePlaceholder />
            )}
            {isRocket && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-xs font-bold text-slate-700 shadow-sm">
                <Rocket className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
                로켓배송
              </span>
            )}
          </div>

          <div className="flex flex-col p-5 sm:p-7">
            <p className="text-sm font-bold text-slate-500">
              {product.brand} · {CATEGORY_LABEL[product.category]}
            </p>
            <h1 className="mt-2 text-2xl font-extrabold leading-snug text-slate-900">
              {product.name}
            </h1>

            <div className="mt-5 rounded-xl bg-brand-50/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-600">실측 크기</span>
                {product.verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                    스펙 확인
                  </span>
                )}
              </div>
              <p className="mt-2 text-center text-2xl font-extrabold tabular-nums text-brand-900">
                {formatCm(product.dimensions.width)} × {formatCm(product.dimensions.depth)} ×{' '}
                {formatCm(product.dimensions.height)}
                <span className="ml-1 text-sm font-bold text-brand-600">cm</span>
              </p>
              <p className="mt-1 text-center text-xs font-medium text-brand-500">가로 × 깊이 × 높이</p>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-600">{product.capacity_or_spec}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-6">
              {product.price ? (
                <div className="flex items-end justify-between gap-4">
                  <p>
                    <span className="text-3xl font-extrabold tabular-nums text-rose-600">
                      {formatWon(product.price)}
                    </span>
                    <span className="ml-1 text-lg font-bold text-rose-600">원</span>
                  </p>
                  <span className="pb-1 text-xs text-slate-400">
                    {formatCheckedAt(product.priceCheckedAt)}
                  </span>
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-400">쿠팡에서 가격 확인</p>
              )}

              <a
                href={coupangHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="mt-4 flex items-center justify-center gap-1 rounded-xl bg-orange-700 px-4 py-3.5 text-base font-extrabold text-white transition hover:bg-orange-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
              >
                쿠팡에서 보기
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </a>

              <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-400">
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                쿠팡에서 상품 옵션, 재고, 배송정보와 현재 가격을 다시 확인해 주세요.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
