import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SizeFinderApp from '@/components/SizeFinderApp';
import { getLiveProducts } from '@/lib/liveCatalog';
import { SITE_URL } from '@/lib/productPage';
import { homeItemListJsonLd } from '@/lib/structuredData';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 상세페이지 목록 구조화 데이터 (개별 항목은 Product 가 아니다 — src/lib/structuredData.ts) */
function StructuredData({ products }: { products: Product[] }) {
  const jsonLd = homeItemListJsonLd(products, SITE_URL);

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
