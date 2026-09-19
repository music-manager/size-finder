'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, ImageOff } from 'lucide-react';
import { CATEGORY_LABEL } from '@/lib/categories';
import { formatCm } from '@/lib/products';
import type { Product } from '@/lib/types';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const { width, depth, height } = product.dimensions;
  // 원격 이미지가 죽어도 카드 레이아웃이 깨지지 않도록 대체 블록을 보여준다.
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {imageFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
            <span className="px-3 text-center text-[11px] font-medium">
              이미지 준비 중
            </span>
          </div>
        ) : (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImageFailed(true)}
            unoptimized
          />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-slate-900/75 px-2 py-1 text-[11px] font-bold text-white">
          {CATEGORY_LABEL[product.category]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-xs font-semibold text-brand-600">{product.brand}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-slate-900">
            {product.name}
          </h3>
        </div>

        {/* 실측 정보: 카드에서 가장 눈에 띄어야 하는 핵심 값 */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { key: 'W', label: '가로', value: width },
            { key: 'D', label: '깊이', value: depth },
            { key: 'H', label: '높이', value: height },
          ].map((dim) => (
            <div
              key={dim.key}
              className="rounded-lg bg-brand-50 px-1.5 py-2 text-center"
            >
              <p className="text-[10px] font-bold text-brand-500">
                {dim.key} · {dim.label}
              </p>
              <p className="text-sm font-extrabold tabular-nums text-brand-800">
                {formatCm(dim.value)}
                <span className="text-[10px] font-bold">cm</span>
              </p>
            </div>
          ))}
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
