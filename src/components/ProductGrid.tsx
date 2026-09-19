'use client';

import ProductCard from './ProductCard';
import EmptyState from './EmptyState';
import type { Product } from '@/lib/types';

interface Props {
  products: Product[];
  doorClearance: boolean;
  onReset: () => void;
}

export default function ProductGrid({
  products,
  doorClearance,
  onReset,
}: Props) {
  if (products.length === 0) {
    return <EmptyState onReset={onReset} />;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          doorClearance={doorClearance}
        />
      ))}
    </div>
  );
}
