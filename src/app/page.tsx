import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SizeFinderApp from '@/components/SizeFinderApp';
import { products } from '@/lib/products';

/** 검색 결과 리치 스니펫용 구조화 데이터 */
function StructuredData() {
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
        image: product.imageUrl,
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

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <Header />
      <main>
        <SizeFinderApp />
      </main>
      <Footer />
    </>
  );
}
