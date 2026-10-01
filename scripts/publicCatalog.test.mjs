/**
 * 공개 카탈로그 VERIFIED / REVIEW 분리.
 *
 * - REVIEW 에는 dimensions 가 없고, filterProducts · fit 계산에 들어가지 않는다.
 * - 같은 productId 는 한 번만 센다(verified 와 겹치면 verified 쪽만).
 * - REVIEW 카드의 외부 링크는 CTA resolver(tracked canonical)만 쓴다.
 * - 제목에서 치수를 뽑거나 identity 를 만들지 않는다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  PUBLIC_CATALOG_TARGET,
  buildPublicCatalog,
  publicCountFor,
  reviewForCategories,
  toReviewCandidate,
  verifiedProductKey,
} from '../src/lib/publicCatalog.ts';
import { resolveCoupangCta } from '../src/lib/coupangCta.ts';
import { loadRepoCatalog } from './catalog-gate.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const PRODUCTS = readJson('src/data/products.json');
const REGISTRY = readJson('src/data/coupang-cta-provenance.json');
const PENDING = readdirSync(join(ROOT, 'src/data'))
  .filter((f) => /^pending.*\.json$/.test(f))
  .sort()
  .flatMap((f) => readJson(`src/data/${f}`));
const REVIEW_FILE = readJson('src/data/review-candidates.json');
const SEED_PAGE_KEYS = Object.fromEntries(
  Object.entries(REGISTRY.seedById).map(([id, identity]) => [id, identity.pageKey]),
);

const FORBIDDEN_REVIEW_KEYS = ['dimensions', 'width', 'depth', 'height', 'dimensionCandidate', 'verified', 'tags'];

const record = (overrides = {}) => ({
  id: 'cp-1234567890',
  name: '테스트 소형 냉장고 70×30×90',
  category: 'refrigerator',
  brand: '테스트',
  capacity_or_spec: '',
  imageUrl: 'https://ads-partners.coupang.com/image1/x',
  coupangUrl: 'https://link.coupang.com/re/AFFSDP?lptag=AF3873783&pageKey=1234567890&itemId=1&vendorItemId=2&traceid=V0-153-aaaa',
  tags: ['로켓배송'],
  price: 100000,
  priceCheckedAt: '2026-09-25',
  productId: 1234567890,
  keyword: '원룸 냉장고',
  rank: 1,
  collectedAt: '2026-09-24T19:14:08.702Z',
  ...overrides,
});

const verifiedProduct = (overrides = {}) => ({
  id: 'v-1',
  name: '검증 상품',
  category: 'refrigerator',
  brand: 'B',
  dimensions: { width: 50, depth: 50, height: 80 },
  capacity_or_spec: '',
  imageUrl: '',
  coupangUrl: '',
  tags: [],
  verified: true,
  ...overrides,
});

describe('REVIEW 후보 — 저장된 실수집 필드만', () => {
  it('review 에는 dimensions 가 없고(치수 관련 키 0개), status=review 이다', () => {
    const candidate = toReviewCandidate(record({ dimensions: { width: 1, depth: 1, height: 1 }, dimensionCandidate: { width: 70 } }));
    assert.equal(candidate.status, 'review');
    for (const key of FORBIDDEN_REVIEW_KEYS) assert.equal(key in candidate, false, key);
  });

  it('제목 속 숫자(70×30×90)에서 치수를 만들지 않는다', () => {
    const candidate = toReviewCandidate(record());
    assert.equal(JSON.stringify(candidate).includes('"width"'), false);
    const code = stripComments(read('src/lib/publicCatalog.ts'));
    assert.doesNotMatch(code, /extractDimensionCandidate|productPipeline|dimension/i);
  });

  it('productId · itemId · vendorItemId 를 만들지 않는다: productId 없거나 이상하면 후보가 아니다', () => {
    for (const bad of [undefined, null, 0, -1, 1.5, 'abc', '123x']) {
      assert.equal(toReviewCandidate(record({ productId: bad })), null, String(bad));
    }
    const code = stripComments(read('src/lib/publicCatalog.ts'));
    assert.doesNotMatch(code, /itemId|vendorItemId|pageKey\s*=|searchParams/);
  });

  it('이름 · 카테고리가 없거나 모르는 카테고리면 후보가 아니다', () => {
    for (const key of ['name', 'category']) {
      assert.equal(toReviewCandidate(record({ [key]: '' })), null, key);
    }
    assert.equal(toReviewCandidate(record({ category: 'unknown' })), null);
  });

  it('coupangUrl 이 없어도 후보는 되지만 링크 재료가 없다', () => {
    const candidate = toReviewCandidate(record({ coupangUrl: '' }));
    assert.equal(candidate.coupangUrl, '');
  });

  it('web_index 출처는 저장 URL 이 있어도 coupangUrl 을 비우고 sourceUrl 만 남긴다', () => {
    const candidate = toReviewCandidate(record({ source: 'coupang_web_index', sourceUrl: 'https://www.coupang.com/vp/products/1234567890?itemId=1' }));
    assert.equal(candidate.source, 'coupang_web_index');
    assert.equal(candidate.coupangUrl, '');
    assert.equal(candidate.sourceUrl, 'https://www.coupang.com/vp/products/1234567890?itemId=1');
  });

  it('itemId · vendorItemId · note 는 후보로 복사하지 않는다', () => {
    const candidate = toReviewCandidate(record({ itemId: '1', vendorItemId: '2', note: 'x' }));
    for (const key of ['itemId', 'vendorItemId', 'note']) assert.equal(key in candidate, false, key);
  });
});

describe('VERIFIED / REVIEW 분리', () => {
  it('verified 에는 verified=true Product 만 남고 review 는 섞이지 않는다', () => {
    const catalog = buildPublicCatalog(
      [verifiedProduct(), verifiedProduct({ id: 'v-2', verified: false })],
      [record()],
    );
    assert.deepEqual(catalog.verified.map((p) => p.id), ['v-1']);
    assert.ok(catalog.verified.every((p) => p.verified === true && p.dimensions));
    assert.ok(catalog.review.every((c) => c.status === 'review' && !('dimensions' in c)));
  });

  it('verified 와 같은 productId 의 review 는 빠진다 (seed pageKey 포함)', () => {
    const catalog = buildPublicCatalog(
      [verifiedProduct({ productId: 1234567890 }), verifiedProduct({ id: 'dry-006' })],
      [record(), record({ id: 'cp-8321193275', productId: 8321193275 })],
      SEED_PAGE_KEYS,
    );
    assert.deepEqual(catalog.review, []);
    assert.equal(catalog.uniqueProductIds, 2);
  });

  it('duplicate productId 0: 같은 productId 는 한 번만', () => {
    const catalog = buildPublicCatalog([], [record(), record({ id: 'dup' }), record({ id: 'other', productId: 2 })]);
    const ids = catalog.review.map((c) => c.productId);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, [1234567890, 2]);
    assert.equal(catalog.uniqueProductIds, 2);
  });

  it('verified productKey 는 저장된 productId 또는 seed pageKey 만 (추측 없음)', () => {
    assert.equal(verifiedProductKey(verifiedProduct({ productId: 5 })), 5);
    assert.equal(verifiedProductKey(verifiedProduct({ id: 'dry-006' }), SEED_PAGE_KEYS), 8321193275);
    assert.equal(verifiedProductKey(verifiedProduct({ id: 'dry-008' }), SEED_PAGE_KEYS), null);
  });

  it('카테고리 필터만 적용하고 치수 조건은 쓰지 않는다', () => {
    const review = buildPublicCatalog([], [record(), record({ id: 'd', productId: 3, category: 'desk' })]).review;
    assert.deepEqual(reviewForCategories(review, ['desk']).map((c) => c.productId), [3]);
    assert.equal(reviewForCategories(review, null).length, 2);
    assert.equal(reviewForCategories.length, 2, '치수 인자를 받지 않는다');
  });
});

describe('fit engine 에는 verified 만', () => {
  const app = stripComments(read('src/components/SizeFinderApp.tsx'));

  it('SizeFinderApp 는 publicCatalog.verified 만 filterProducts 에 넘긴다', () => {
    assert.match(app, /const catalog = publicCatalog\.verified;/);
    const calls = [...app.matchAll(/filterProducts\(\s*([A-Za-z_.]+)/g)].map((m) => m[1]);
    assert.ok(calls.length > 0);
    assert.deepEqual([...new Set(calls)], ['catalog']);
    assert.doesNotMatch(app, /filterProducts\([^)]*review/i);
  });

  it('REVIEW 컴포넌트는 filterProducts · fit 계산 · 치수 필드를 쓰지 않는다', () => {
    for (const path of ['src/components/ReviewCatalogSection.tsx', 'src/components/ReviewCard.tsx']) {
      const code = stripComments(read(path));
      assert.doesNotMatch(code, /filterProducts|fitClearance|fitLabel|effectiveDepth|\.dimensions|maxWidth|maxDepth|maxHeight/, path);
    }
  });
});

describe('REVIEW 공개 UI', () => {
  const section = read('src/components/ReviewCatalogSection.tsx');
  const card = stripComments(read('src/components/ReviewCard.tsx'));

  it('카드에 "치수 검증 중" 이 보인다', () => {
    assert.match(card, /치수 검증 중/);
  });

  it('필수 안내문이 있다', () => {
    assert.ok(section.includes('치수 확인 전 상품은 공간 적합도 계산에서 제외됩니다.'));
  });

  it('REVIEW 를 "내 공간에 맞는 상품" 으로 표현하지 않는다', () => {
    for (const code of [section, card]) {
      assert.doesNotMatch(code, /내 공간에 맞는|공간에 맞는 상품|들어가는 제품/);
    }
  });

  it('홈 구조화 데이터(SEO)는 verified 만 쓴다', () => {
    const page = stripComments(read('src/app/page.tsx'));
    assert.match(page, /<StructuredData products=\{liveProducts\} \/>/);
    assert.doesNotMatch(page, /review|ReviewCandidate|pendingProducts/i);
  });
});

describe('REVIEW CTA — tracked canonical 만 외부 링크', () => {
  const card = stripComments(read('src/components/ReviewCard.tsx'));

  it('ReviewCard 는 coupangUrl 을 href 로 쓰지 않고 resolver 결과만 쓴다', () => {
    assert.doesNotMatch(card, /href=\{candidate\.coupangUrl\}|href=\{[^}]*coupangUrl/);
    assert.match(card, /const coupangHref =\s*candidate\.source === 'coupang_search'\s*\?\s*coupangCtaHref\(\{[\s\S]*?\}\)\s*:\s*null;/);
    // coupangUrl 은 resolver 입력으로만 쓰인다 (fallback 링크 금지)
    const callStart = card.indexOf('coupangCtaHref(');
    const callArgs = card.slice(callStart, card.indexOf('});', callStart));
    const total = (card.match(/coupangUrl/g) ?? []).length;
    assert.equal(total, (callArgs.match(/coupangUrl/g) ?? []).length, 'resolver 밖에서 coupangUrl 을 쓴다');
    assert.doesNotMatch(card, /coupangCtaHref\([\s\S]*?\)\s*(\?\?|\|\|)/, 'resolver 결과에 fallback 이 붙었다');
    const anchors = [...card.matchAll(/<a[\s>]/g)];
    assert.equal(anchors.length, 1);
    assert.match(card, /\{coupangHref \? \(\s*<a\s+href=\{coupangHref\}\s*target="_blank"\s*rel="noopener noreferrer sponsored"/);
    const unsafe = card.slice(card.indexOf(') : (', card.indexOf('{coupangHref ? (')));
    assert.match(unsafe.slice(0, 400), /구매 링크 검증 중/);
    assert.doesNotMatch(unsafe.slice(0, 400), /<a[\s>]|href=/);
  });

  it('실데이터 REVIEW 의 외부 CTA 는 전부 tracked canonical 이고, raw AFFSDP · /a/ clickable 0', () => {
    const { review } = loadRepoCatalog();
    let active = 0;
    for (const candidate of review) {
      const { href, source } = resolveCoupangCta(
        { id: `cp-${candidate.productId}`, coupangUrl: candidate.coupangUrl, productId: candidate.productId },
        REGISTRY,
      );
      if (href === null) {
        assert.equal(source, null);
        continue;
      }
      active += 1;
      assert.match(href, /^https:\/\/www\.coupang\.com\/vp\/products\/\d+\?itemId=\d+&vendorItemId=\d+&lptag=[^&]+&subid=cmpick&traceid=V0-183-[0-9a-f]+$/);
      assert.notEqual(href, candidate.coupangUrl);
      assert.equal(source, 'landing');
    }
    const landingKeys = new Set(Object.keys(REGISTRY.landingByProductId));
    assert.equal(active, review.filter((c) => landingKeys.has(String(c.productId))).length);
  });
});

describe('실데이터 공개 카탈로그', () => {
  const catalog = loadRepoCatalog();

  it('duplicate productId 0', () => {
    const ids = catalog.review.map((c) => c.productId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('review 후보는 모두 저장된 기록(pending · review-candidates)에서 왔고 dimensions 가 없다', () => {
    const pendingIds = new Set([...PENDING, ...REVIEW_FILE].map((p) => p.productId));
    for (const candidate of catalog.review) {
      assert.ok(pendingIds.has(candidate.productId), String(candidate.productId));
      for (const key of FORBIDDEN_REVIEW_KEYS) assert.equal(key in candidate, false, `${candidate.productId} ${key}`);
    }
  });

  it('unique productId 수는 verified productKey ∪ review productId 와 같다', () => {
    const keys = new Set(catalog.review.map((c) => c.productId));
    for (const product of catalog.verified) {
      const key = verifiedProductKey(product, SEED_PAGE_KEYS);
      if (key !== null) keys.add(key);
    }
    assert.equal(catalog.uniqueProductIds, keys.size);
  });

  it(`1차 완료 게이트 목표는 ${PUBLIC_CATALOG_TARGET} 이다 (npm run catalog:gate)`, () => {
    assert.equal(PUBLIC_CATALOG_TARGET, 100);
    assert.match(read('package.json'), /"catalog:gate": "node scripts\/catalog-gate\.mjs"/);
  });
});

describe('카테고리 탭 숫자 = 공개 총상품 수', () => {
  it('publicCountFor 는 verified + review 를 카테고리로만 센다(치수 조건 없음)', () => {
    const catalog = buildPublicCatalog(
      [verifiedProduct({ id: 'v-1', category: 'dryer', productId: 9 })],
      [record({ productId: 1, category: 'dryer' }), record({ id: 'b', productId: 2, category: 'bed' })],
    );
    assert.equal(publicCountFor(catalog, ['dryer']), 2);
    assert.equal(publicCountFor(catalog, ['bed']), 1);
    assert.equal(publicCountFor(catalog, ['sofa']), 0);
    assert.equal(publicCountFor(catalog, null), 3);
  });

  it('SizeFinderApp 탭 숫자는 publicCountFor, 결과 수는 verified 를 거른 visible 그대로', () => {
    const app = stripComments(read('src/components/SizeFinderApp.tsx'));
    assert.match(app, /result\[category\.id\] = publicCountFor\(publicCatalog, CATEGORY_MATCH\[category\.id\]\)/);
    assert.match(app, /<span className="text-brand-600">\{visible\.length\}<\/span>개/);
    assert.match(app, /sortProducts\(filterProducts\(catalog, filters\), filters\.sort\)/);
  });

  it('verified 가 없는 카테고리는 "치수에 맞는 제품이 없다" 대신 안내를 보이고 review 를 fit 에 넣지 않는다', () => {
    const app = stripComments(read('src/components/SizeFinderApp.tsx'));
    assert.match(app, /const onlyReviewInCategory = verifiedInCategory === 0 && reviewInCategory > 0;/);
    assert.match(app, /\{onlyReviewInCategory \? \(/);
    assert.match(app, /verifiedInCategory = publicCountFor\(\{ verified: catalog, review: \[\] \}/);
    assert.doesNotMatch(app, /준비 중/);
  });
});

describe('빈 카테고리 0 — review-candidates.json', () => {
  const catalog = loadRepoCatalog();
  const EMPTY_BEFORE = ['dishwasher', 'folding_table', 'niche', 'bed', 'sofa', 'hanger', 'shoe_rack'];

  it('7개 카테고리 모두 공개 상품 1개 이상', () => {
    for (const category of EMPTY_BEFORE) {
      assert.ok(publicCountFor(catalog, [category]) >= 1, category);
    }
  });

  it('탭에 있는 모든 카테고리가 공개 상품 1개 이상 (빈 탭 0)', () => {
    const match = { refrigerator: ['refrigerator'], washing_machine: ['washing_machine'], dryer: ['dryer'], dishwasher: ['dishwasher'], microwave: ['microwave'], desk: ['desk', 'shelf'], folding_table: ['folding_table'], niche: ['niche'], bed: ['bed'], sofa: ['sofa'], hanger: ['hanger'], shoe_rack: ['shoe_rack'] };
    const tabs = [...read('src/lib/categories.ts').matchAll(/\{ id: '([a-z_]+)', label:/g)].map((m) => m[1]).filter((id) => id !== 'all');
    assert.deepEqual(tabs.sort(), Object.keys(match).sort());
    for (const tab of tabs) assert.ok(publicCountFor(catalog, match[tab]) >= 1, tab);
  });

  it('파일에 치수 관련 키가 없고 productId 는 양의 정수, 중복 없음', () => {
    const ids = REVIEW_FILE.map((r) => r.productId);
    assert.equal(new Set(ids).size, ids.length);
    for (const row of REVIEW_FILE) {
      assert.ok(Number.isSafeInteger(row.productId) && row.productId > 0, String(row.productId));
      for (const key of ['dimensions', 'width', 'depth', 'height', 'dimensionCandidate', 'verified']) {
        assert.equal(key in row, false, `${row.productId} ${key}`);
      }
      assert.ok(['coupang_search', 'coupang_web_index'].includes(row.source), String(row.productId));
    }
  });

  it('web_index 5건은 외부 CTA 0 (resolver 를 거치지 않는다)', () => {
    const web = catalog.review.filter((c) => c.source === 'coupang_web_index');
    assert.equal(web.length, 5);
    for (const candidate of web) {
      assert.equal(candidate.coupangUrl, '');
      assert.match(candidate.sourceUrl, new RegExp(`^https://www\\.coupang\\.com/vp/products/${candidate.productId}\\?itemId=\\d+$`));
    }
  });

  it('식기세척기 · 신발장 raw Search 후보는 저장된 Deep Link provenance 가 없으므로 CTA 0', () => {
    const landing = REGISTRY.landingByProductId;
    const targets = catalog.review.filter((c) => ['dishwasher', 'shoe_rack'].includes(c.category));
    assert.equal(targets.length, 3);
    for (const candidate of targets) {
      assert.equal(Object.prototype.hasOwnProperty.call(landing, String(candidate.productId)), false);
      const { href } = resolveCoupangCta(
        { id: `cp-${candidate.productId}`, coupangUrl: candidate.coupangUrl, productId: candidate.productId },
        REGISTRY,
      );
      assert.equal(href, null, String(candidate.productId));
    }
  });
});
