import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SizeFinderApp from '@/components/SizeFinderApp';
import { getLiveProducts } from '@/lib/liveCatalog';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 검색 결과 리치 스니펫용 구조화 데이터 */
function StructuredData({ products }: { products: Product[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '원룸 맞춤 가전·가구 실측 목록',
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        brand: { '@type': 'Brand', name: product.brand },
        ...(product.imageUrl ? { image: product.imageUrl } : {}),
        width: {
          '@type': 'QuantitativeValue',
          value: product.dimensions.width,
          unitCode: 'CMT',
        },
        depth: {
          '@type': 'QuantitativeValue',
          value: product.dimensions.depth,
          unitCode: 'CMT',
        },
        height: {
          '@type': 'QuantitativeValue',
          value: product.dimensions.height,
          unitCode: 'CMT',
        },
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function HomePage() {
  const liveProducts = await getLiveProducts();

  return (
    <>
      <StructuredData products={liveProducts} />
      <Header />
      <main>
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-20 text-center text-sm text-slate-400">
              불러오는 중…
            </div>
          }
        >
          <SizeFinderApp initialProducts={liveProducts} />
        </Suspense>
      </main>
      {/* 홈에는 모바일 하단 고정 필터 바가 있다 */}
      <Footer hasMobileBottomBar />
    </>
  );
}
