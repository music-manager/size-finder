/**
 * 검색엔진용 JSON-LD.
 *
 * - 홈 `/` ItemList 에는 Product 노드가 없어야 한다 (Search Console "제품 스니펫 잘못된 항목" 원인).
 * - 상세 `/p/[id]` Product 는 표시 가격 + 검증된 구매 버튼이 모두 있을 때만, 저장된 값으로만.
 * - JSON-LD 는 쿠팡 URL 을 담지 않고 CTA 계산을 바꾸지 않는다.
 * 기대값은 DB 없는 fail-soft 공개 카탈로그(sitemap.test.mjs 와 같은 경로)에서 파생한다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { homeItemListJsonLd, productCanonicalUrl, productJsonLd } from '../src/lib/structuredData.ts';
import { resolveCoupangCta, resolveCoupangTrackedHref } from '../src/lib/coupangCta.ts';
import { appendVerifiedBatch, buildVerifiedBatchProducts } from '../src/lib/verifiedBatch.ts';
import {
  dedupeVerifiedByProductKey,
  isPublicIncompleteProductId,
  verifiedProductKey,
} from '../src/lib/publicCatalog.ts';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SITE_URL = read('src/lib/productPage.ts').match(/export const SITE_URL = '([^']+)'/)[1];
const REGISTRY = readJson('src/data/coupang-cta-provenance.json');
const SEED_PAGE_KEYS = Object.fromEntries(Object.entries(REGISTRY.seedById).map(([id, i]) => [id, i.pageKey]));
const keyOf = (p) => verifiedProductKey(p, SEED_PAGE_KEYS);

const SEEDS = readJson('src/data/products.json').filter((p) => p.verified);
const BATCH = buildVerifiedBatchProducts(readJson('src/data/verified-batch-44.json'), readJson('src/data/review-candidates.json'));
const { kept: PUBLIC } = dedupeVerifiedByProductKey(
  appendVerifiedBatch(SEEDS, BATCH, keyOf).filter((p) => !isPublicIncompleteProductId(p.productId)),
  SEED_PAGE_KEYS,
);

const ctaOf = (p) => resolveCoupangTrackedHref(p, REGISTRY);
const detailLd = (p, ctaHref = ctaOf(p)) => productJsonLd(p, { siteUrl: SITE_URL, ctaHref, description: '설명' });
// 쿠팡 구매 · 제휴 링크 (상품 이미지 CDN coupangcdn.com 은 허용)
const AFFILIATE_URL = /(link|www|m)\.coupang\.com|coupa\.ng|V0-153|traceid|lptag|AFFSDP/i;
const CANONICAL = /^https:\/\/cmpick\.esedy\.com\/p\/[A-Za-z0-9-]+$/;
const RICH_RESULT_EXTRAS = ['availability', 'review', 'aggregateRating', 'priceValidUntil', 'itemCondition', 'seller'];

/** JSON-LD 안의 모든 객체 노드 */
function nodes(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => nodes(v, out));
  else if (value && typeof value === 'object') {
    out.push(value);
    Object.values(value).forEach((v) => nodes(v, out));
  }
  return out;
}

describe('홈 / ItemList', () => {
  const ld = homeItemListJsonLd(PUBLIC, SITE_URL);

  it('Product 노드가 하나도 없다 (제품 스니펫 잘못된 항목 0)', () => {
    assert.ok(PUBLIC.length > 50, String(PUBLIC.length));
    const types = nodes(ld).map((n) => n['@type']).filter(Boolean);
    assert.equal(types.includes('Product'), false);
    assert.equal(types.includes('Offer'), false);
    assert.deepEqual([...new Set(types)].sort(), ['ItemList', 'ListItem']);
  });

  it('ListItem 마다 position · name · 상세 canonical URL', () => {
    assert.equal(ld['@type'], 'ItemList');
    assert.equal(ld.numberOfItems, PUBLIC.length);
    assert.equal(ld.itemListElement.length, PUBLIC.length);
    ld.itemListElement.forEach((item, i) => {
      assert.equal(item['@type'], 'ListItem');
      assert.equal(item.position, i + 1);
      assert.equal(item.name, PUBLIC[i].name);
      assert.ok(item.name.trim().length > 0, PUBLIC[i].id);
      assert.equal(item.url, `${SITE_URL}/p/${PUBLIC[i].id}`);
      assert.match(item.url, CANONICAL);
      assert.equal('item' in item, false);
    });
    assert.equal(new Set(ld.itemListElement.map((i) => i.url)).size, PUBLIC.length, 'URL 중복 0');
  });

  it('쿠팡 URL · 가격 · 치수를 담지 않는다', () => {
    const json = JSON.stringify(ld);
    assert.doesNotMatch(json, AFFILIATE_URL);
    assert.doesNotMatch(json, /"(price|offers|width|depth|height)"/);
  });

  it('page.tsx 는 homeItemListJsonLd 를 쓰고 Product 를 직접 만들지 않는다', () => {
    const src = stripComments(read('src/app/page.tsx'));
    assert.match(src, /homeItemListJsonLd\(products, SITE_URL\)/);
    assert.doesNotMatch(src, /'@type': 'Product'|Offer/);
    // 홈 목록 = 상세페이지와 같은 공개 카탈로그
    assert.match(src, /const liveProducts = await getLiveProducts\(\);/);
  });
});

describe('상세 /p/[id] Product', () => {
  it('공개 상품: 표시 가격 + 구매 버튼이 있으면 Product, 저장값만 쓴다', () => {
    let emitted = 0;
    for (const p of PUBLIC) {
      const href = ctaOf(p);
      const ld = detailLd(p);
      if (!href || !p.price) {
        assert.equal(ld, null, p.id);
        continue;
      }
      emitted += 1;
      assert.equal(ld['@type'], 'Product');
      assert.equal(ld.name, p.name);
      assert.equal(ld.url, productCanonicalUrl(SITE_URL, p));
      assert.match(ld.url, CANONICAL);
      assert.deepEqual(
        [ld.width.value, ld.depth.value, ld.height.value],
        [p.dimensions.width, p.dimensions.depth, p.dimensions.height],
      );
      assert.ok(ld.width.unitCode === 'CMT' && ld.depth.unitCode === 'CMT' && ld.height.unitCode === 'CMT');
      if (p.imageUrl) assert.equal(ld.image, p.imageUrl);
      else assert.equal('image' in ld, false);
      if (p.brand.trim()) assert.equal(ld.brand.name, p.brand.trim());
      else assert.equal('brand' in ld, false, `빈 brand 미출력 ${p.id}`);
      assert.deepEqual(ld.offers, { '@type': 'Offer', price: p.price, priceCurrency: 'KRW', url: ld.url });
      for (const node of nodes(ld)) {
        for (const key of RICH_RESULT_EXTRAS) assert.equal(key in node, false, `${key} ${p.id}`);
      }
      assert.doesNotMatch(JSON.stringify(ld), AFFILIATE_URL, p.id);
    }
    assert.ok(emitted > 0);
  });

  it('구매 링크 검증 중(ctaHref 없음) · 가격 없음 · unverified 는 Product 를 내지 않는다', () => {
    const base = PUBLIC.find((p) => p.price && ctaOf(p));
    assert.ok(base);
    assert.equal(detailLd(base, null), null, '구매 링크 검증 중');
    assert.equal(detailLd({ ...base, price: undefined }), null, '가격 없음');
    assert.equal(detailLd({ ...base, price: 0 }), null, '가격 0');
    assert.equal(detailLd({ ...base, verified: false }), null, 'unverified');
  });

  it('ProductDetail 은 productJsonLd 를 쓰고 null 이면 script 를 그리지 않는다', () => {
    const src = stripComments(read('src/components/ProductDetail.tsx'));
    assert.match(src, /const jsonLd = productJsonLd\(product, \{\s*siteUrl: SITE_URL,\s*ctaHref: coupangHref,/);
    assert.match(src, /\{jsonLd && \(\s*<script\s+type="application\/ld\+json"/);
    assert.doesNotMatch(src, /availability|InStock|aggregateRating/);
  });

  it('상세페이지 canonical = /p/{id} (metadataBase = SITE_URL)', () => {
    assert.match(stripComments(read('src/app/p/[id]/page.tsx')), /alternates: \{ canonical: `\/p\/\$\{product\.id\}` \}/);
    assert.match(read('src/app/layout.tsx'), /metadataBase: new URL\(SITE_URL\)/);
    assert.match(read('src/app/layout.tsx'), /const SITE_URL = 'https:\/\/cmpick\.esedy\.com';/);
    for (const p of PUBLIC) assert.match(productCanonicalUrl(SITE_URL, p), CANONICAL);
  });
});

describe('CTA · affiliate URL 불변', () => {
  it('ProductDetail CTA 는 기존 그대로 (coupangCtaHref · rel sponsored)', () => {
    const src = stripComments(read('src/components/ProductDetail.tsx'));
    assert.match(src, /const coupangHref = coupangCtaHref\(product\);/);
    assert.match(src, /href=\{coupangHref\}/);
    assert.match(src, /rel="noopener noreferrer sponsored"/);
    assert.match(src, /구매 링크 검증 중/);
  });

  it('structuredData 는 CTA 를 계산 · 저장하지 않는다 (쿠팡 모듈 import 0)', () => {
    const src = stripComments(read('src/lib/structuredData.ts'));
    assert.doesNotMatch(src, /coupang|import \{/i);
    assert.match(src, /^import type \{ Product \} from '\.\/types';$/m);
  });

  it('raw V0-153 CTA 는 저장 원문 그대로만, 새로 만들지 않는다', () => {
    for (const p of PUBLIC) {
      const { source, href } = resolveCoupangCta(p, REGISTRY);
      if (source === 'search-raw') assert.equal(href, p.coupangUrl, `저장 원문 ${p.id}`);
      if (href && /traceid=V0-153-/.test(href)) assert.equal(href, p.coupangUrl, `V0-153 합성 금지 ${p.id}`);
    }
    // productId 와 pageKey 가 다른 V0-153 원문은 CTA 가 아니고 Product 도 없다
    const raw = PUBLIC.find((p) => resolveCoupangCta(p, REGISTRY).source === 'search-raw');
    assert.ok(raw);
    const mismatched = { ...raw, id: 'cp-1', productId: 1 };
    assert.equal(ctaOf(mismatched), null);
    assert.equal(detailLd(mismatched), null);
    // 검색 URL 은 CTA 가 아니다
    const search = { ...raw, coupangUrl: 'https://www.coupang.com/np/search?q=%EB%83%89%EC%9E%A5%EA%B3%A0' };
    assert.equal(ctaOf(search), null);
    assert.equal(detailLd(search), null);
  });
});
