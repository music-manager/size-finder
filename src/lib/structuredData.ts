/**
 * 검색엔진용 JSON-LD (순수 함수).
 *
 * - 홈 `/`: ItemList > ListItem(position · name · url) 만. 개별 항목을 Product 로 두지 않는다.
 *   Google 은 ListItem 안의 Product 를 제품 스니펫으로 검사해 offers · review · aggregateRating
 *   이 없으면 "잘못된 항목"으로 잡는다. 상품 정보는 각 상세페이지가 맡는다.
 * - 상세 `/p/[id]`: 화면에 가격이 보이고 구매 버튼(검증된 CTA)도 있는 상품만 Product 를 낸다.
 *   그 밖의 상품(구매 링크 검증 중 · 가격 없음)은 Product 를 내지 않는다(빈 Product 는 잘못된 항목).
 * - 저장된 검증값만 쓴다: name · image(있을 때) · brand(있을 때) · 치수 · canonical URL · 표시 가격.
 *   재고(availability) · 리뷰 · 평점 · 가격 유효기간은 근거가 없으므로 만들지 않는다.
 * - 쿠팡 URL 은 JSON-LD 에 넣지 않는다. Offer.url 은 상세페이지 canonical 이다.
 *
 * Node 테스트가 직접 import 하므로 경로 별칭·JSON import 를 쓰지 않는다.
 */
import type { Product } from './types';

/** 상세페이지 canonical URL */
export function productCanonicalUrl(siteUrl: string, product: Pick<Product, 'id'>): string {
  return `${siteUrl}/p/${product.id}`;
}

/** 홈 ItemList — 상세페이지 링크 목록 */
export function homeItemListJsonLd(
  products: ReadonlyArray<Pick<Product, 'id' | 'name'>>,
  siteUrl: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '원룸 맞춤 가전·가구 실측 목록',
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: productCanonicalUrl(siteUrl, product),
    })),
  };
}

function cm(value: number) {
  return { '@type': 'QuantitativeValue', value, unitCode: 'CMT' };
}

/**
 * 상세페이지 Product. 제품 스니펫 요건(offers)을 실제 값으로 채울 수 없으면 null.
 * - verified 상품만
 * - 화면에 보이는 가격(product.price)과 구매 버튼 href(ctaHref)가 모두 있어야 한다.
 *   ctaHref 는 노출 여부 판단에만 쓰고 JSON-LD 에는 넣지 않는다.
 */
export function productJsonLd(
  product: Product,
  options: { siteUrl: string; ctaHref: string | null; description: string },
) {
  if (product.verified !== true) return null;
  if (!options.ctaHref) return null;
  const price = product.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;

  const url = productCanonicalUrl(options.siteUrl, product);
  const brand = product.brand.trim();
  const { width, depth, height } = product.dimensions;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: options.description,
    url,
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    width: cm(width),
    depth: cm(depth),
    height: cm(height),
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: 'KRW',
      url,
    },
  };
}
