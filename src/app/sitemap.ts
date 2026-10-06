import type { MetadataRoute } from 'next';
import { getLiveProducts } from '@/lib/liveCatalog';
import { SITE_URL } from '@/lib/productPage';

// /p/[id] 상세페이지와 같은 공개 카탈로그(운영 DB verified 포함)를 쓰므로 요청 시점에 만든다
export const dynamic = 'force-dynamic';

/**
 * 공개 VERIFIED 상세페이지 전체.
 * getLiveProducts() 결과를 그대로 쓴다 — unverified · pending · REVIEW · 공개 불완전 · 중복 productId 는
 * 상세페이지와 같은 필터로 이미 빠져 있다. DB 장애 시에는 저장소 VERIFIED(seed + 검증 배치)로 fail-soft.
 * 안정적인 수정일 데이터가 없으므로 lastModified 는 넣지 않는다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getLiveProducts();

  return [
    {
      url: SITE_URL,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...products.map((product) => ({
      url: `${SITE_URL}/p/${product.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
