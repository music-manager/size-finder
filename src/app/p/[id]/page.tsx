import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AffiliateNotice from '@/components/AffiliateNotice';
import ProductDetail from '@/components/ProductDetail';
import ProductGrid from '@/components/ProductGrid';
import { products } from '@/lib/products';
import { getLiveCatalog, getLiveProducts } from '@/lib/liveCatalog';
import {
  SITE_URL,
  findProduct,
  pageDescription,
  pageTitle,
  similarProducts,
} from '@/lib/productPage';
import { CATEGORY_LABEL } from '@/lib/categories';

interface Params {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return products.map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const catalog = await getLiveProducts();
  const product = findProduct(params.id, catalog);
  if (!product) return { title: '없는 제품' };

  const title = pageTitle(product);
  const description = pageDescription(product);
  const url = `${SITE_URL}/p/${product.id}`;

  return {
    title,
    description,
    alternates: { canonical: `/p/${product.id}` },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      url,
      title,
      description,
      ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { products: catalog, duplicates } = await getLiveCatalog();
  const product = findProduct(params.id, catalog);
  if (!product) {
    // 같은 쿠팡 productId 라서 정리된 카드의 예전 링크는 남은 카드로 보낸다
    const duplicate = duplicates.find((row) => row.id === params.id);
    if (duplicate) permanentRedirect(`/p/${duplicate.keptId}`);
    notFound();
  }

  const similar = similarProducts(product, 4, catalog);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6">
        <nav className="mb-3 flex items-center gap-1 text-xs text-slate-500">
          <Link href="/" className="hover:text-brand-600">
            센치픽
          </Link>
          <span>›</span>
          <Link
            href={`/?c=${product.category}`}
            className="hover:text-brand-600"
          >
            {CATEGORY_LABEL[product.category]}
          </Link>
        </nav>

        {/* 쿠팡에서 보기 CTA 와 비슷한 크기 상품 목록보다 먼저 파트너스 고지를 1회 표시한다 */}
        <AffiliateNotice className="mb-3" />

        <ProductDetail product={product} />

        {similar.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-bold text-slate-900">
              비슷한 크기의 {CATEGORY_LABEL[product.category]}
            </h2>
            <ProductGrid products={similar} />
          </section>
        )}

        <Link
          href={`/?c=${product.category}`}
          className="mt-8 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {CATEGORY_LABEL[product.category]} 전체 보기
        </Link>
      </main>
      <Footer />
    </>
  );
}
