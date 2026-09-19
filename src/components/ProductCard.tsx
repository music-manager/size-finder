'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { CATEGORY_EMOJI, CATEGORY_LABEL } from '@/lib/categories';
import { formatCm } from '@/lib/products';
import type { Product } from '@/lib/types';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const { width, depth, height } = product.dimensions;
  // imageUrl 이 비어 있으면(=쿠팡 정품 이미지 확보 전) 이미지 영역을 통째로 생략한다.
  // 제품과 무관한 사진은 신뢰도를 떨어뜨리므로 없는 편이 낫다.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(product.imageUrl) && !imageFailed;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
      {showImage && (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImageFailed(true)}
            unoptimized
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">{CATEGORY_EMOJI[product.category]}</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            {CATEGORY_LABEL[product.category]}
          </span>
          <span className="ml-auto text-[11px] font-bold text-brand-600">
            {product.brand}
          </span>
        </div>

        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
          {product.name}
        </h3>

        {/* 실측 정보 — 사진이 없는 만큼 카드의 시각적 중심이 된다 */}
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-2.5">
          <p className="mb-2 text-center text-[10px] font-bold tracking-wide text-brand-500">
            실측 크기 (cm)
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { key: 'W', label: '가로', value: width },
              { key: 'D', label: '깊이', value: depth },
              { key: 'H', label: '높이', value: height },
            ].map((dim) => (
              <div key={dim.key} className="text-center">
                <p className="text-[10px] font-bold text-brand-400">
                  {dim.key} · {dim.label}
                </p>
                <p className="text-lg font-extrabold leading-tight tabular-nums text-brand-800">
                  {formatCm(dim.value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-center text-xs font-bold text-slate-700">
          {formatCm(width)} × {formatCm(depth)} × {formatCm(height)} cm ·{' '}
          {product.capacity_or_spec}
        </p>

        <ul className="flex flex-wrap gap-1">
          {product.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500"
            >
              #{tag}
            </li>
          ))}
        </ul>

        <a
          href={product.coupangUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700 active:scale-[0.99]"
        >
          쿠팡 최저가 보러가기
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
