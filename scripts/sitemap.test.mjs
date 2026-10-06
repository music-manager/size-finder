/**
 * sitemap.xml = 공개 VERIFIED 상세페이지(/p/[id]) 전체.
 *
 * - sitemap.ts 는 상세페이지와 같은 getLiveProducts() 를 그대로 쓴다(별도 필터 없음).
 * - 운영 DB 가 없을 때(fail-soft)의 저장소 공개 카탈로그로 기대 URL 을 파생해 확인한다.
 *   seed verified + 검증 배치 → 공개 불완전 제외 → productId dedupe (liveCatalog.getLiveCatalog 와 같은 순서)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { appendVerifiedBatch, buildVerifiedBatchProducts } from '../src/lib/verifiedBatch.ts';
import {
  PUBLIC_INCOMPLETE_PRODUCT_IDS,
  buildPublicCatalog,
  dedupeVerifiedByProductKey,
  isPublicIncompleteProductId,
  verifiedProductKey,
} from '../src/lib/publicCatalog.ts';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SITE_URL = read('src/lib/productPage.ts').match(/export const SITE_URL = '([^']+)'/)[1];
const SITEMAP_SRC = stripComments(read('src/app/sitemap.ts'));

const SEEDS = readJson('src/data/products.json').filter((p) => p.verified);
const RECORDS = readJson('src/data/review-candidates.json');
const PENDING = readdirSync(new URL('../src/data', import.meta.url))
  .filter((f) => /^pending.*\.json$/.test(f))
  .flatMap((f) => readJson(`src/data/${f}`));
const REGISTRY = readJson('src/data/coupang-cta-provenance.json');
const SEED_PAGE_KEYS = Object.fromEntries(Object.entries(REGISTRY.seedById).map(([id, i]) => [id, i.pageKey]));
const keyOf = (p) => verifiedProductKey(p, SEED_PAGE_KEYS);

// getLiveCatalog() 의 DB 없는 경로와 같은 순서로 만든 공개 VERIFIED 상세페이지 목록
const BATCH = buildVerifiedBatchProducts(readJson('src/data/verified-batch-44.json'), RECORDS);
const { kept: FALLBACK_PUBLIC } = dedupeVerifiedByProductKey(
  appendVerifiedBatch(SEEDS, BATCH, keyOf).filter((p) => !isPublicIncompleteProductId(p.productId)),
  SEED_PAGE_KEYS,
);

// sitemap.ts 와 같은 모양의 항목
const sitemapFrom = (products) => [
  `${SITE_URL}`,
  `${SITE_URL}/privacy`,
  ...products.map((p) => `${SITE_URL}/p/${p.id}`),
];
const URLS = sitemapFrom(FALLBACK_PUBLIC);
const detail = (id) => `${SITE_URL}/p/${id}`;

// Issue #44 HOLD (verifiedBatch44.test.mjs 와 같은 목록)
const HOLD = [8750671365, 9522527501, 7660428989, 28896030, 9748766128, 6784715012, 9642239361];

describe('sitemap.ts 배선', () => {
  it('getLiveProducts 결과를 그대로 쓰고 seed products 를 직접 쓰지 않는다', () => {
    assert.match(SITEMAP_SRC, /import \{ getLiveProducts \} from '@\/lib\/liveCatalog';/);
    assert.doesNotMatch(SITEMAP_SRC, /@\/lib\/products'/);
    assert.match(SITEMAP_SRC, /const products = await getLiveProducts\(\);/);
    assert.match(SITEMAP_SRC, /\.\.\.products\.map\(\(product\) => \(\{\s*url: `\$\{SITE_URL\}\/p\/\$\{product\.id\}`/);
    assert.doesNotMatch(SITEMAP_SRC, /products\.filter|\.filter\(/, 'sitemap 전용 필터를 따로 두지 않는다');
    assert.match(SITEMAP_SRC, /export const dynamic = 'force-dynamic';/);
  });

  it('lastModified 를 넣지 않는다 (요청마다 "방금 수정"으로 보이지 않게)', () => {
    assert.doesNotMatch(SITEMAP_SRC, /lastModified|new Date\(/);
  });

  it('홈 · privacy 를 유지하고 /admin · 쿼리 URL 을 만들지 않는다', () => {
    assert.match(SITEMAP_SRC, /url: SITE_URL,/);
    assert.match(SITEMAP_SRC, /url: `\$\{SITE_URL\}\/privacy`/);
    assert.doesNotMatch(SITEMAP_SRC, /admin|\?[a-z]=/);
  });

  it('상세페이지 · 홈과 같은 공개 카탈로그 경로를 쓴다 (liveCatalog 필터 그대로)', () => {
    const live = stripComments(read('src/lib/liveCatalog.ts'));
    assert.match(live, /withVerifiedBatch\(verifiedOnly\(await getAllLiveProducts\(\)\)\)\.filter\(\s*\(product\) => !isPublicIncompleteProductId\(product\.productId\),?\s*\)/);
    assert.match(stripComments(read('src/app/p/[id]/page.tsx')), /await getLiveCatalog\(\)/);
  });
});

describe('DB 없는 fallback 기준 sitemap URL', () => {
  it('홈 · privacy + 공개 VERIFIED 상세페이지 전부', () => {
    assert.equal(URLS[0], SITE_URL);
    assert.equal(URLS[1], `${SITE_URL}/privacy`);
    assert.equal(URLS.length, 2 + FALLBACK_PUBLIC.length);
    // seed 3 보다 훨씬 많다 (seed + 검증 배치)
    assert.ok(FALLBACK_PUBLIC.length > SEEDS.length + 40, String(FALLBACK_PUBLIC.length));
    for (const product of BATCH) {
      if (isPublicIncompleteProductId(product.productId)) continue;
      assert.ok(URLS.includes(detail(product.id)), product.id);
    }
  });

  it('대표 포함: seed dry-006 · dry-007 · dry-008, 배치 cp-8982193574 · cp-9015838125', () => {
    for (const id of ['dry-006', 'dry-007', 'dry-008', 'cp-8982193574', 'cp-9015838125']) {
      assert.ok(URLS.includes(detail(id)), id);
    }
  });

  it('공개 불완전 · HOLD · REVIEW · pending 상품 URL 은 0건', () => {
    const publicKeys = new Set(FALLBACK_PUBLIC.map(keyOf).filter((k) => k !== null));
    const urlIds = new Set(URLS.slice(2).map((u) => u.slice(`${SITE_URL}/p/`.length)));
    for (const pid of PUBLIC_INCOMPLETE_PRODUCT_IDS) {
      assert.equal(publicKeys.has(pid), false, `incomplete ${pid}`);
      assert.equal(urlIds.has(`cp-${pid}`), false, `incomplete ${pid}`);
    }
    for (const pid of HOLD) assert.equal(urlIds.has(`cp-${pid}`), false, `HOLD ${pid}`);
    // REVIEW 카드(치수 미확인)는 상세페이지가 없다
    const catalog = buildPublicCatalog(appendVerifiedBatch(SEEDS, BATCH, keyOf), [...PENDING, ...RECORDS], SEED_PAGE_KEYS);
    assert.ok(catalog.review.length > 0);
    for (const candidate of catalog.review) {
      assert.equal(publicKeys.has(candidate.productId), false, `REVIEW ${candidate.productId}`);
      assert.equal(urlIds.has(`cp-${candidate.productId}`), false, `REVIEW ${candidate.productId}`);
    }
    // pending 은 verified 가 아니면 들어오지 않는다
    for (const row of PENDING) {
      if (!publicKeys.has(Number(row.productId))) assert.equal(urlIds.has(row.id), false, `pending ${row.id}`);
    }
    for (const product of FALLBACK_PUBLIC) assert.equal(product.verified, true, product.id);
  });

  it('중복 productId URL 0 · id 중복 0', () => {
    const keys = FALLBACK_PUBLIC.map(keyOf).filter((k) => k !== null);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(new Set(URLS).size, URLS.length);
  });

  it('상세 URL 형식은 https://cmpick.esedy.com/p/{id} 만, /admin · 쿼리 0', () => {
    assert.equal(SITE_URL, 'https://cmpick.esedy.com');
    for (const url of URLS.slice(2)) assert.match(url, /^https:\/\/cmpick\.esedy\.com\/p\/[A-Za-z0-9-]+$/);
    assert.equal(URLS.filter((u) => u.includes('/admin')).length, 0);
    assert.equal(URLS.filter((u) => u.includes('?')).length, 0);
  });
});
