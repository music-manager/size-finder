'use client';

import ProductCard from './ProductCard';
import EmptyState from './EmptyState';
import type { Product } from '@/lib/types';
import type { DimensionTriple } from '@/lib/fit';

interface Props {
  products: Product[];
  doorClearance?: boolean;
  /** 치수를 실제로 좁혔을 때만 넘긴다. 카드가 여유 공간을 표시한다. */
  fitContext?: DimensionTriple;
  /**
   * 빈 상태에서 필터를 되돌리는 동작.
   * 서버 컴포넌트에서는 함수를 넘길 수 없으므로 선택값으로 둔다.
   */
  onReset?: () => void;
}

export default function ProductGrid({
  products,
  doorClearance = false,
  fitContext,
  onReset,
}: Props) {
  if (products.length === 0) {
    return onReset ? (
      <EmptyState onReset={onReset} />
    ) : (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-400">
        해당하는 제품이 없습니다.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          doorClearance={doorClearance}
          fitContext={fitContext}
        />
      ))}
    </div>
  );
}
