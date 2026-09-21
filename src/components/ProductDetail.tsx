'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { BadgeCheck, DoorOpen, ExternalLink, Rocket } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';
import { CATEGORY_LABEL } from '@/lib/categories';
import {
  DOOR_CLEARANCE_CM,
  ROCKET_TAG,
  formatCm,
  needsDoorClearance,
} from '@/lib/products';
import { formatCheckedAt, formatWon } from '@/lib/adminParse';
import { SITE_URL, dimensionText, pageDescription } from '@/lib/productPage';
import type { Product } from '@/lib/types';

interface Props {
  product: Product;
}

export default function ProductDetail({ product }: Props) {
  const { width, depth, height } = product.dimensions;
  const [sourceIndex, setSourceIndex] = useState(0);

  const sources = useMemo(() => {
    if (!product.imageUrl) return [];
    const upgraded = product.imageUrl.replace(/\/\d+x\d+ex\//, '/492x492ex/');
    return upgraded === product.imageUrl
      ? [product.imageUrl]
      : [upgraded, product.imageUrl];
  }, [product.imageUrl]);

  const imageSrc = sources[sourceIndex];
  const hasDoor = needsDoorClearance(product);
  const isRocket = product.tags.includes(ROCKET_TAG);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: pageDescription(product),
    brand: { '@type': 'Brand', name: product.brand },
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    width: { '@type': 'QuantitativeValue', value: width, unitCode: 'CMT' },
    depth: { '@type': 'QuantitativeValue', value: depth, unitCode: 'CMT' },
    height: { '@type': 'QuantitativeValue', value: height, unitCode: 'CMT' },
    ...(product.price
      ? {
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'KRW',
            url: `${SITE_URL}/p/${product.id}`,
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="grid gap-5 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* 사진 */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {imageSrc ? (
            imageSrc.startsWith('data:') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={imageSrc}
                src={imageSrc}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-contain p-4"
                onError={() => setSourceIndex((i) => i + 1)}
              />
            ) : (
              <Image
                key={imageSrc}
                src={imageSrc}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, 320px"
                className="object-contain p-4"
                onError={() => setSourceIndex((i) => i + 1)}
                unoptimized
                priority
              />
            )
          ) : (
            <ImagePlaceholder size="lg" />
          )}
          {isRocket && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-bold leading-none text-slate-600 shadow-sm">
              <Rocket className="h-3 w-3 text-sky-500" aria-hidden="true" />
              로켓배송
            </span>
          )}
        </div>

        {/* 정보 */}
        <div>
          <p className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-slate-900">{product.brand}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">
              {CATEGORY_LABEL[product.category]}
            </span>
          </p>
          <h1 className="mt-1 text-lg font-extrabold leading-snug text-slate-900 sm:text-xl">
            {product.name}
          </h1>

          {/* 실측 — 이 페이지의 본론 */}
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <p className="flex items-center justify-between text-xs font-bold text-brand-500">
              실측 크기
              {product.verified && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  제조사 스펙 확인
                </span>
              )}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { key: 'W', label: '가로', value: width },
                { key: 'D', label: '깊이', value: depth },
                { key: 'H', label: '높이', value: height },
              ].map((dim) => (
                <div
                  key={dim.key}
                  className="rounded-xl bg-white px-2 py-2.5 text-center"
                >
                  <p className="text-[10px] font-bold text-brand-400">
                    {dim.key} · {dim.label}
                  </p>
                  <p className="text-xl font-extrabold leading-tight tabular-nums text-brand-800">
                    {formatCm(dim.value)}
                    <span className="text-[11px] font-bold">cm</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] font-semibold text-brand-700">
              {dimensionText(product)} cm
            </p>
          </div>

          {hasDoor && (
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
              <DoorOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                문을 열면 앞쪽으로 <b>{formatCm(depth + DOOR_CLEARANCE_CM)}cm</b> 가
                필요합니다. 놓을 자리 앞에 그만큼 여유가 있는지 확인하세요.
              </span>
            </p>
          )}

          {product.capacity_or_spec && (
            <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              {product.capacity_or_spec}
            </p>
          )}

          <ul className="mt-2 flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500"
              >
                #{tag}
              </li>
            ))}
          </ul>

          <div className="mt-5">
            {product.price ? (
              <p className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tabular-nums text-rose-600">
                  {formatWon(product.price)}
                </span>
                <span className="text-base font-bold text-rose-600">원</span>
                <span className="ml-1 text-[11px] text-slate-400">
                  {formatCheckedAt(product.priceCheckedAt)}
                </span>
              </p>
            ) : (
              <p className="text-sm font-bold text-slate-400">
                가격은 쿠팡에서 확인하세요
              </p>
            )}

            <a
              href={product.coupangUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-[0.99]"
            >
              쿠팡에서 보기
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              가격과 재고는 쿠팡에서 수시로 바뀝니다. 구매 전 실제 페이지에서
              확인하세요.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
