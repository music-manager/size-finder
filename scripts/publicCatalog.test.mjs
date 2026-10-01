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
  CATEGORY_IDENTITY_RULES,
  dedupeVerifiedByProductKey,
  hasPublicImage,
  publicCatalogStats,
  MIN_PUBLIC_PER_CATEGORY,
  PUBLIC_CATALOG_TARGET,
  REVIEW_IDENTITY_ALLOWLIST,
  REVIEW_IDENTITY_DENYLIST,
  buildPublicCatalog,
  categoryIdentityRejection,
  categoryShortfalls,
  uniqueProductIdsFor,
  publicCountFor,
  reviewForCategories,
  toReviewCandidate,
  verifiedProductKey,
} from '../src/lib/publicCatalog.ts';
import { resolveCoupangCta } from '../src/lib/coupangCta.ts';
import { PUBLIC_TABS, loadRepoCatalog } from './catalog-gate.mjs';

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

// 카테고리 본체 확인 규칙을 통과하는 카테고리별 테스트 상품명
const BODY_NAMES = {
  refrigerator: '테스트 소형 냉장고 70×30×90',
  washing_machine: '테스트 미니 세탁기 3kg',
  dryer: '테스트 미니 의류건조기 4kg',
  dishwasher: '테스트 미니 식기세척기 3인용',
  microwave: '테스트 전자레인지 20L',
  desk: '테스트 원룸 컴퓨터 책상',
  shelf: '테스트 5단 철제 선반',
  bed: '테스트 싱글 침대 프레임',
  hanger: '테스트 이동식 2단 행거',
  niche: '테스트 슬림 틈새수납장',
  sofa: '테스트 1인용 패브릭 소파',
  folding_table: '테스트 원룸 접이식 테이블',
  shoe_rack: '테스트 슬림 신발장',
};

const record = (overrides = {}) => ({
  id: 'cp-1234567890',
  name: BODY_NAMES[overrides.category ?? 'refrigerator'],
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
    assert.equal(PUBLIC_CATALOG_TARGET, 1000);
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

  it('SizeFinderApp 탭 숫자는 uniqueProductIdsFor(공개 고유상품), 결과 수는 verified 를 거른 visible 그대로', () => {
    const app = stripComments(read('src/components/SizeFinderApp.tsx'));
    assert.match(app, /result\[category\.id\] = uniqueProductIdsFor\(publicCatalog, CATEGORY_MATCH\[category\.id\], SEED_PAGE_KEYS\)/);
    assert.doesNotMatch(app, /result\[category\.id\] = publicCountFor/);
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

  it('식기세척기 수저통(7219542646, 액세서리)은 넣지 않는다', () => {
    assert.equal(REVIEW_FILE.some((r) => r.productId === 7219542646), false);
  });

  it('coupang_search 행의 저장 URL 은 같은 productId · itemId · vendorItemId 를 가리킨다', () => {
    for (const row of REVIEW_FILE.filter((r) => r.source === 'coupang_search' && r.coupangUrl)) {
      const q = new URL(row.coupangUrl).searchParams;
      assert.equal(q.get('pageKey'), String(row.productId), String(row.productId));
      if (row.itemId) assert.equal(q.get('itemId'), row.itemId, String(row.productId));
      if (row.vendorItemId) assert.equal(q.get('vendorItemId'), row.vendorItemId, String(row.productId));
    }
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

  it('web_index 5건은 이미지가 없어 공개 REVIEW 에서 빠지고, 저장 기록은 provenance 로 남는다', () => {
    const web = REVIEW_FILE.filter((r) => r.source === 'coupang_web_index');
    assert.equal(web.length, 5);
    for (const row of web) {
      assert.equal(row.imageUrl ?? '', '', String(row.productId));
      assert.match(row.sourceUrl, new RegExp(`^https://www\\.coupang\\.com/vp/products/${row.productId}\\?itemId=\\d+$`));
    }
    assert.equal(catalog.review.filter((c) => c.source === 'coupang_web_index').length, 0);
  });

  it('식기세척기 · 접이식테이블 · 신발장 raw Search(V0-153) 후보는 Deep Link provenance 가 없으므로 CTA 0', () => {
    const landing = REGISTRY.landingByProductId;
    const targets = catalog.review.filter(
      (c) => c.source === 'coupang_search' && ['dishwasher', 'folding_table', 'shoe_rack'].includes(c.category),
    );
    assert.equal(targets.length, 20, '식기세척기 7 + 접이식테이블 6(본체 표기 없는 2건 제외) + 신발장 7');
    for (const candidate of targets) {
      const traceid = new URL(candidate.coupangUrl).searchParams.get('traceid');
      assert.match(traceid, /^V0-153-/, String(candidate.productId));
    }
    for (const candidate of targets) {
      assert.equal(Object.prototype.hasOwnProperty.call(landing, String(candidate.productId)), false);
      const { href } = resolveCoupangCta(
        { id: `cp-${candidate.productId}`, coupangUrl: candidate.coupangUrl, productId: candidate.productId },
        REGISTRY,
      );
      assert.equal(href, null, String(candidate.productId));
    }
  });

  it('Search call 38~42(침대 · 행거 · 틈새수납 · 소파 · 신발장) 원문은 V0-153 provenance 전용이라 CTA 0', () => {
    const landing = REGISTRY.landingByProductId;
    const rows = REVIEW_FILE.filter((r) => /^중앙 coupang_api_cache Search call (38|39|40|41|42) /.test(r.note ?? ''));
    assert.equal(rows.length, 37);
    const byCategory = {};
    for (const row of rows) byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    assert.deepEqual(byCategory, { bed: 8, hanger: 9, niche: 7, sofa: 9, shoe_rack: 4 });
    for (const row of rows) {
      assert.equal(row.source, 'coupang_search');
      assert.match(new URL(row.coupangUrl).searchParams.get('traceid'), /^V0-153-/, String(row.productId));
      assert.equal(Object.prototype.hasOwnProperty.call(landing, String(row.productId)), false);
      const { href } = resolveCoupangCta(
        { id: `cp-${row.productId}`, coupangUrl: row.coupangUrl, productId: row.productId },
        REGISTRY,
      );
      assert.equal(href, null, String(row.productId));
    }
  });

  it('Search call 38~42 와 갱신된 7646511942 는 itemId · vendorItemId 를 갖고 저장 URL 의 pageKey · itemId · vendorItemId 와 정확히 같다', () => {
    const rows = REVIEW_FILE.filter((r) => /Search call (38|39|40|41|42) /.test(r.note ?? ''));
    assert.equal(rows.length, 38, '신규 37 + 기존 7646511942 원문 갱신 1');
    for (const row of rows) {
      assert.match(row.itemId ?? '', /^\d+$/, String(row.productId));
      assert.match(row.vendorItemId ?? '', /^\d+$/, String(row.productId));
      const url = new URL(row.coupangUrl);
      assert.equal(url.origin + url.pathname, 'https://link.coupang.com/re/AFFSDP', String(row.productId));
      assert.equal(url.searchParams.get('pageKey'), String(row.productId));
      assert.equal(url.searchParams.get('itemId'), row.itemId, String(row.productId));
      assert.equal(url.searchParams.get('vendorItemId'), row.vendorItemId, String(row.productId));
    }
    // QA 댓글 5930232387 식별자 표 일부 대조
    const spot = { 5163831345: ['7111900766', '74403790032'], 205424106: ['605086165', '4586166287'], 9734856136: ['29132870492', '95805582314'], 9568773446: ['28558964711', '95851252936'], 7646511942: ['20333184541', '76616985658'] };
    for (const [productId, [itemId, vendorItemId]] of Object.entries(spot)) {
      const row = rows.find((r) => r.productId === Number(productId));
      assert.ok(row, productId);
      assert.deepEqual([row.itemId, row.vendorItemId], [itemId, vendorItemId], productId);
    }
  });

  it('productId 중복 0 — review 파일은 pending · seed 와 겹치지 않고 카탈로그 unique 수와 일치한다', () => {
    const pendingIds = new Set(PENDING.map((p) => Number(p.productId)).filter(Boolean));
    const seedIds = new Set(Object.values(SEED_PAGE_KEYS).map(Number));
    for (const row of REVIEW_FILE) {
      assert.equal(pendingIds.has(row.productId), false, `pending 중복 ${row.productId}`);
      assert.equal(seedIds.has(row.productId), false, `seed 중복 ${row.productId}`);
    }
    const reviewIds = catalog.review.map((c) => c.productId);
    assert.equal(new Set(reviewIds).size, reviewIds.length);
    const verifiedKeys = catalog.verified.map((p) => verifiedProductKey(p, SEED_PAGE_KEYS)).filter((k) => k !== null);
    assert.equal(catalog.uniqueProductIds, new Set([...verifiedKeys, ...reviewIds]).size);
  });

  it('신발장 중복(7646511942)은 기존 1건만 두고 거치 액세서리(9738898746)는 제외한다', () => {
    assert.equal(REVIEW_FILE.filter((r) => r.productId === 7646511942).length, 1);
    assert.equal(REVIEW_FILE.some((r) => r.productId === 9738898746), false);
    assert.equal(catalog.review.filter((c) => c.productId === 7646511942).length, 1);
  });
});

describe('카테고리별 최소 공개 상품 수', () => {
  it('MIN_PUBLIC_PER_CATEGORY 는 10 이다', () => {
    assert.equal(MIN_PUBLIC_PER_CATEGORY, 10);
  });

  it('uniqueProductIdsFor 는 같은 productId 를 한 번만 세고 productKey 없는 verified 는 세지 않는다', () => {
    const catalog = buildPublicCatalog(
      [verifiedProduct({ id: 'x', category: 'bed' }), verifiedProduct({ id: 'y', category: 'bed', productId: 5 })],
      [record({ productId: 5, category: 'bed' }), record({ id: 'b', productId: 6, category: 'bed' })],
    );
    assert.equal(uniqueProductIdsFor(catalog, ['bed']), 2);
  });

  it('categoryShortfalls 는 기준 미만 탭을 적은 순으로 돌려준다', () => {
    const catalog = buildPublicCatalog([], [
      record({ productId: 1, category: 'bed' }),
      record({ id: 'a', productId: 2, category: 'sofa' }),
      record({ id: 'b', productId: 3, category: 'sofa' }),
    ]);
    const tabs = [{ id: 'bed', allowed: ['bed'] }, { id: 'sofa', allowed: ['sofa'] }, { id: 'hanger', allowed: ['hanger'] }];
    assert.deepEqual(categoryShortfalls(catalog, tabs, {}, 2), [{ id: 'hanger', count: 0 }, { id: 'bed', count: 1 }]);
    assert.deepEqual(categoryShortfalls(catalog, tabs, {}, 0), []);
  });

  it('게이트는 홈 탭 12개(전체 제외)를 모두 검사한다', () => {
    assert.equal(PUBLIC_TABS.length, 12);
    assert.ok(PUBLIC_TABS.every((t) => Array.isArray(t.allowed) && t.allowed.length > 0));
    const gate = read('scripts/catalog-gate.mjs');
    assert.match(gate, /if \(!totalOk \|\| shortfalls\.length\)/);
  });
});

describe('카테고리 본체 확인 (category identity guard)', () => {
  const pass = (name, category, productId = 1111111111) => categoryIdentityRejection(productId, name, category) === null;

  it('13개 category 모두 규칙이 있고, 정상 본체 상품명은 통과한다', () => {
    assert.deepEqual(Object.keys(CATEGORY_IDENTITY_RULES).sort(), Object.keys(BODY_NAMES).sort());
    const real = {
      refrigerator: 'LG전자 121L 2도어 미니 일반 냉장고 방문설치',
      washing_machine: '누아브 초강력 미니 세탁기 소형 원룸 기숙사, 아이보리, mini',
      dryer: '보닉 스퀘어 AI 미니 의류건조기 4KG UV-C살균 소형의류건조기 벽걸이 미니건조기 원룸건조기 신발건조기 빨래건조기',
      dishwasher: '쿠쿠 마시멜로 식기세척기 3인용',
      microwave: '퀵미니 전자레인지 샤인 20L 사무실 원룸 편의점 화이트 블랙 택일 PMW-S20LW',
      desk: '발작 1인용 이동식 컴퓨터책상 미니 작은책상, 모던화이트, 고객직접설치',
      shelf: '철제 5단 선반 랙 블랙',
      bed: '무소음 박스 I자형수납 고급커버 단면매트 / 1인 원룸가구 인테리어가구 침대프레임 매트리스 수납가능, 플레어그레이',
      hanger: '가화홈시스 기본형 2단 옷걸이 행거 NLB2200',
      niche: '다층 이동식 틈새장 200 좁은 공간 냉장고옆 세탁기옆 슬림 수납장, 크림색',
      sofa: 'NOVALIVE 1인용 원목 코듀로이 패브릭 소파 쇼파의자 안락의자 원룸 거실 침실, 원목 그레이',
      folding_table: 'Takata 접이식 식탁 원룸 소형 폴딩 테이블 간이 접이식 테이블 FT2',
      shoe_rack: '메르하임 현관 벤치형 튼튼한 신발장 정리대, 2단, 화이트 x 60cm',
    };
    for (const [category, name] of Object.entries(real)) assert.ok(pass(name, category), `${category}: ${name}`);
    for (const [category, name] of Object.entries(BODY_NAMES)) assert.ok(pass(name, category), `${category}: ${name}`);
  });

  it('다른 카테고리 상품이 저장 category 로 잘못 들어오면 제외한다 (cross-category)', () => {
    const cases = [
      ['매직쉐프 디지털 전자레인지 20L', 'refrigerator'],
      ['LG전자 121L 2도어 미니 냉장고', 'washing_machine'],
      ['한일 UV살균 미니 의류건조기 5kg', 'washing_machine'],
      ['누아브 초강력 미니 세탁기', 'dryer'],
      ['미니 세탁기 건조기 일체형', 'dryer'],
      ['쿠쿠 식기세척기 3인용', 'microwave'],
      ['전자렌지 냉장고 인덕션 올인원 세트', 'microwave'],
      ['원룸 컴퓨터 책상', 'folding_table'],
      ['코너 틈새 수납장', 'shoe_rack'],
      ['1인용 패브릭 소파', 'bed'],
      ['이동식 2단 행거', 'sofa'],
      ['슬림 신발장', 'hanger'],
      ['싱글 침대 프레임', 'niche'],
      ['5단 철제 선반', 'desk'],
    ];
    for (const [name, category] of cases) assert.equal(pass(name, category), false, `${category} ← ${name}`);
  });

  it('refrigerator 8763219111 (전자레인지 · 인덕션 혼합 세트) · 9725295650 (차량 · 캠핑 4L 냉온장고) 제외 — id 와 이름 규칙 양쪽', () => {
    const set = '전자렌지 냉장고 인덕션 올인원 자취방 혼자 자취 세트 소형 미니 전자레인지 원룸 공간절약';
    const car = '원룸용 미니 냉온장고 4L 화장품 보관함 차량 캠핑용 냉장고 자동차 시거잭';
    assert.equal(pass(set, 'refrigerator', 8763219111), false);
    assert.equal(pass(car, 'refrigerator', 9725295650), false);
    // denylist 가 없어도 이름 규칙만으로 제외된다
    assert.equal(pass(set, 'refrigerator'), false);
    assert.equal(pass(car, 'refrigerator'), false);
    assert.equal(toReviewCandidate(record({ productId: 8763219111, name: set })), null);
    assert.equal(toReviewCandidate(record({ productId: 9725295650, name: car })), null);
  });

  it('washing_machine 검색 원문 오염 예시 4건 제외 (QA 설명 기준 이름)', () => {
    const rows = [
      [7867973739, '신일 의류 건조기 4kg'],
      [9052797062, '원룸 미니건조기 소형 빨래 건조기'],
      [8700854258, '드럼 세탁기 전용 액체 세제 3L'],
      [8778410758, '세탁기 앞 발매트 러그'],
    ];
    for (const [productId, name] of rows) {
      assert.equal(pass(name, 'washing_machine', productId), false, String(productId));
      assert.equal(pass(name, 'washing_machine'), false, `이름 규칙만: ${name}`);
      assert.ok(Object.prototype.hasOwnProperty.call(REVIEW_IDENTITY_DENYLIST, String(productId)));
    }
  });

  it('dishwasher 7219542646 수저통 · shoe_rack 9738898746 거치 액세서리 제외 유지', () => {
    assert.equal(pass('식기세척기 전용 수저통 바스켓', 'dishwasher', 7219542646), false);
    assert.equal(pass('식기세척기 전용 수저통 바스켓', 'dishwasher'), false);
    assert.equal(pass('자석식 신발 거치대 현관 신발걸이', 'shoe_rack', 9738898746), false);
    assert.equal(pass('자석식 신발 거치대 현관 신발걸이', 'shoe_rack'), false);
    assert.equal(pass('미닉스 미니 식기세척기 PRO 3인용', 'dishwasher', 7219542646), false, 'id 로도 고정');
  });

  it('액세서리 · 소모품 · 부품 · 차량용은 어느 카테고리든 제외', () => {
    assert.equal(pass('소형 냉장고 정리함 4개입', 'refrigerator'), false);
    assert.equal(pass('세탁기 배수 호스 2m', 'washing_machine'), false);
    assert.equal(pass('의류건조기 필터 교체용', 'dryer'), false);
    assert.equal(pass('식기세척기 린스 500ml', 'dishwasher'), false);
    assert.equal(pass('전자레인지 선반 2단 수납장', 'microwave'), false);
    assert.equal(pass('전자레인지장 렌지대', 'microwave'), false);
    assert.equal(pass('침대 매트리스 커버 슈퍼싱글', 'bed'), false);
    assert.equal(pass('소파 커버 3인용', 'sofa'), false);
    assert.equal(pass('행거 커버 투명', 'hanger'), false);
    assert.equal(pass('차량용 미니 냉장고 12V', 'refrigerator'), false);
    assert.equal(pass('행거 부품 연결 브라켓', 'hanger'), false);
  });

  it('신발 건조기는 의류건조기 표기가 없으면 dryer 에서 제외, "블랙" 의 랙 은 오탐하지 않는다', () => {
    assert.equal(pass('UV 신발 건조기 원룸', 'dryer'), false);
    assert.equal(pass('미니 의류건조기 4kg 신발건조기 겸용', 'dryer'), true);
    assert.equal(pass('전자레인지 20L 블랙', 'microwave'), true);
    assert.equal(pass('미니 식기세척기 3인용 블랙', 'dishwasher'), true);
  });

  it('fail-closed: 규칙 없는 category 는 제외, allowlist 는 비어 있다', () => {
    assert.notEqual(categoryIdentityRejection(1, '냉장고', 'unknown_category'), null);
    assert.deepEqual(Object.keys(REVIEW_IDENTITY_ALLOWLIST), []);
    assert.ok(Object.isFrozen(REVIEW_IDENTITY_ALLOWLIST));
    assert.ok(Object.isFrozen(REVIEW_IDENTITY_DENYLIST));
  });

  it('오염 상품은 publicCountFor · uniqueProductIdsFor · categoryShortfalls 어디에도 집계되지 않는다', () => {
    const records = [
      record({ productId: 1 }),
      record({ id: 'set', productId: 8763219111, name: '전자렌지 냉장고 인덕션 올인원 자취방 혼자 자취 세트' }),
      record({ id: 'car', productId: 9725295650, name: '원룸용 미니 냉온장고 4L 차량 캠핑용 냉장고' }),
      record({ id: 'acc', productId: 2, name: '소형 냉장고 정리함 4개입' }),
    ];
    const catalog = buildPublicCatalog([], records);
    assert.deepEqual(catalog.review.map((c) => c.productId), [1]);
    assert.equal(catalog.uniqueProductIds, 1);
    assert.equal(publicCountFor(catalog, ['refrigerator']), 1);
    assert.equal(uniqueProductIdsFor(catalog, ['refrigerator']), 1);
    assert.deepEqual(categoryShortfalls(catalog, [{ id: 'refrigerator', allowed: ['refrigerator'] }], {}, 2), [{ id: 'refrigerator', count: 1 }]);
  });

  it('저장소 전수 감사: guard 로 빠지는 기록은 정확히 4건이고 gate 카탈로그에 없다', () => {
    const all = [...PENDING, ...REVIEW_FILE].filter((r) => r.productId);
    const rejected = all
      .map((r) => ({ productId: Number(r.productId), why: categoryIdentityRejection(Number(r.productId), String(r.name).trim(), r.category) }))
      .filter((r) => r.why !== null);
    assert.deepEqual(rejected.map((r) => r.productId).sort(), [2354065065, 5659094136, 8763219111, 9725295650]);
    const repo = loadRepoCatalog();
    const shown = new Set(repo.review.map((c) => c.productId));
    for (const { productId } of rejected) assert.equal(shown.has(productId), false, String(productId));
    for (const id of Object.keys(REVIEW_IDENTITY_DENYLIST)) assert.equal(shown.has(Number(id)), false, id);
    for (const candidate of repo.review) assert.equal(categoryIdentityRejection(candidate.productId, candidate.name, candidate.category), null);
    assert.equal(repo.uniqueProductIds, new Set([...shown, ...Object.values(SEED_PAGE_KEYS).map(Number)]).size);
  });

  it('제외된 오염 상품도 dimensions 없음 · V0-153 CTA 비활성 원칙은 그대로', () => {
    const repo = loadRepoCatalog();
    for (const candidate of repo.review) {
      for (const key of FORBIDDEN_REVIEW_KEYS) assert.equal(key in candidate, false, `${candidate.productId} ${key}`);
    }
  });

  it('microwave 탭 라벨은 전자레인지 본체 의도에 맞게 "전자레인지"', () => {
    const tab = PUBLIC_TABS.find((t) => t.id === 'microwave');
    assert.equal(tab.label, '전자레인지');
    assert.doesNotMatch(read('src/lib/categories.ts'), /label: '전자레인지장'/);
  });
});

describe('이슈 #31 — 공개 숫자 · 중복 · 이미지 정합성', () => {
  const SEEDS = PRODUCTS.filter((p) => p.verified);
  const seed = (id) => SEEDS.find((p) => p.id === id);
  // 운영 DB 에 같은 쿠팡 productId 로 등록된 verified 행(시뮬레이션)
  const dbRow = (productId, overrides = {}) =>
    verifiedProduct({ id: `cp-${productId}`, name: `DB ${productId}`, category: 'dryer', productId, dimensions: { width: 1, depth: 1, height: 1 }, ...overrides });
  const DB_DUPES = [dbRow(8321193275), dbRow(8090724268)];
  const WEB_INDEX_IDS = [9653658222, 9555031749, 9727500754, 9728813384, 9730565996];

  it('1. 공개 REVIEW 카드는 모두 https 이미지가 있다 (빈 imageUrl 0건)', () => {
    const repo = loadRepoCatalog();
    assert.ok(repo.review.length > 0);
    for (const candidate of repo.review) assert.ok(hasPublicImage(candidate.imageUrl), String(candidate.productId));
    assert.equal(repo.review.filter((c) => c.imageUrl.trim() === '').length, 0);
  });

  it('2. 이미지 없는 web_index 5건은 공개되지 않고, 빈 · http · 공백 이미지는 REVIEW 가 되지 않는다', () => {
    const shown = new Set(loadRepoCatalog().review.map((c) => c.productId));
    for (const id of WEB_INDEX_IDS) assert.equal(shown.has(id), false, String(id));
    assert.equal(toReviewCandidate(record({ imageUrl: '' })), null);
    assert.equal(toReviewCandidate(record({ imageUrl: '   ' })), null);
    assert.equal(toReviewCandidate(record({ imageUrl: undefined })), null);
    assert.equal(toReviewCandidate(record({ imageUrl: 'http://example.com/a.jpg' })), null);
    assert.equal(toReviewCandidate(record({ imageUrl: 'https://ads-partners.coupang.com/image1/x' })).imageUrl, 'https://ads-partners.coupang.com/image1/x');
  });

  it('3 · 4. seed dry-006/8321193275 · dry-007/8090724268 중복은 seed 카드 한 장만 남는다 (DB 순서와 무관)', () => {
    for (const verified of [[...SEEDS, ...DB_DUPES], [...DB_DUPES, ...SEEDS]]) {
      const catalog = buildPublicCatalog(verified, [], SEED_PAGE_KEYS);
      const ids = catalog.verified.map((p) => p.id);
      assert.ok(ids.includes('dry-006') && ids.includes('dry-007'));
      assert.equal(ids.includes('cp-8321193275'), false);
      assert.equal(ids.includes('cp-8090724268'), false);
      assert.deepEqual(
        catalog.duplicateVerified.map((d) => [d.id, d.productId, d.keptId]).sort(),
        [['cp-8090724268', 8090724268, 'dry-007'], ['cp-8321193275', 8321193275, 'dry-006']],
      );
      const keys = catalog.verified.map((p) => verifiedProductKey(p, SEED_PAGE_KEYS)).filter((k) => k !== null);
      assert.equal(new Set(keys).size, keys.length, '같은 productId 카드 2장 동시 노출 금지');
    }
  });

  it('3 · 4. 남은 seed 카드는 치수 출처와 CTA seed provenance 를 그대로 가진다', () => {
    const catalog = buildPublicCatalog([...DB_DUPES, ...SEEDS], [], SEED_PAGE_KEYS);
    for (const id of ['dry-006', 'dry-007']) {
      const kept = catalog.verified.find((p) => p.id === id);
      assert.deepEqual(kept.dimensions, seed(id).dimensions);
      const cta = resolveCoupangCta(kept, REGISTRY);
      assert.equal(cta.source, 'seed', id);
      assert.ok(cta.href, id);
    }
  });

  it('seed 가 없을 때 DB 끼리 겹치면 먼저 온 카드만 남는다', () => {
    const { kept, duplicates } = dedupeVerifiedByProductKey([dbRow(5), dbRow(5, { id: 'cp-5-b' }), dbRow(6)]);
    assert.deepEqual(kept.map((p) => p.id), ['cp-5', 'cp-6']);
    assert.deepEqual(duplicates, [{ id: 'cp-5-b', productId: 5, keptId: 'cp-5' }]);
  });

  it('5. 홈 전체 · 카테고리 숫자는 unique productId 기준 (중복 · productId 없는 카드 제외)', () => {
    const catalog = buildPublicCatalog([...SEEDS, ...DB_DUPES], [...PENDING, ...REVIEW_FILE], SEED_PAGE_KEYS);
    assert.equal(uniqueProductIdsFor(catalog, null, SEED_PAGE_KEYS), catalog.uniqueProductIds);
    // 카드 수(publicCountFor)는 dry-008 을 포함하므로 고유상품 수보다 1 크다
    assert.equal(publicCountFor(catalog, null), catalog.uniqueProductIds + 1);
    const dryerCards = publicCountFor(catalog, ['dryer']);
    assert.equal(uniqueProductIdsFor(catalog, ['dryer'], SEED_PAGE_KEYS), dryerCards - 1);
    // 중복 DB 행이 들어와도 고유상품 수는 늘지 않는다
    const withoutDupes = buildPublicCatalog(SEEDS, [...PENDING, ...REVIEW_FILE], SEED_PAGE_KEYS);
    assert.equal(catalog.uniqueProductIds, withoutDupes.uniqueProductIds);
    for (const tab of PUBLIC_TABS) {
      assert.equal(
        uniqueProductIdsFor(catalog, tab.allowed, SEED_PAGE_KEYS),
        uniqueProductIdsFor(withoutDupes, tab.allowed, SEED_PAGE_KEYS),
        tab.id,
      );
    }
  });

  it('6. productId 없는 dry-008 은 실측 카드로 남지만 1,000 unique count 에는 들어가지 않는다', () => {
    const catalog = buildPublicCatalog(SEEDS, [], SEED_PAGE_KEYS);
    assert.ok(catalog.verified.some((p) => p.id === 'dry-008'));
    assert.equal(verifiedProductKey(seed('dry-008'), SEED_PAGE_KEYS), null);
    assert.equal(catalog.uniqueProductIds, 2);
    assert.equal(uniqueProductIdsFor(catalog, ['dryer'], SEED_PAGE_KEYS), 2);
    const gate = loadRepoCatalog();
    assert.ok(gate.verified.some((p) => p.id === 'dry-008'));
    assert.equal(gate.uniqueProductIds, new Set([...gate.review.map((c) => c.productId), 8321193275, 8090724268]).size);
  });

  it('7. REVIEW 는 fit 대상(verified)에 들어가지 않는다', () => {
    const catalog = buildPublicCatalog([...SEEDS, ...DB_DUPES], [...PENDING, ...REVIEW_FILE], SEED_PAGE_KEYS);
    const reviewIds = new Set(catalog.review.map((c) => c.productId));
    for (const product of catalog.verified) {
      assert.equal(product.verified, true);
      assert.ok(product.dimensions);
      assert.equal(reviewIds.has(verifiedProductKey(product, SEED_PAGE_KEYS)), false);
    }
    for (const candidate of catalog.review) assert.equal('dimensions' in candidate, false);
    const app = stripComments(read('src/components/SizeFinderApp.tsx'));
    assert.match(app, /const catalog = publicCatalog\.verified;/);
    assert.match(app, /filterProducts\(catalog, filters\)/);
    assert.doesNotMatch(app, /filterProducts\([^)]*review/i);
  });

  it('8. CTA provenance 정책은 그대로 (seed 2 · landing 16 · V0-183 · V0-153 fallback 0)', () => {
    assert.deepEqual(Object.keys(REGISTRY.seedById).sort(), ['dry-006', 'dry-007']);
    assert.equal(Object.keys(REGISTRY.landingByProductId).length, 16);
    for (const identity of Object.values(REGISTRY.seedById)) assert.match(identity.traceid, /^V0-183-[0-9a-f]+$/);
    const repo = loadRepoCatalog();
    for (const candidate of repo.review) {
      const { href, source } = resolveCoupangCta(
        { id: `cp-${candidate.productId}`, coupangUrl: candidate.coupangUrl, productId: candidate.productId },
        REGISTRY,
      );
      if (href) {
        assert.equal(source, 'landing', String(candidate.productId));
        assert.doesNotMatch(href, /V0-153/);
      }
    }
    const card = read('src/components/ReviewCard.tsx');
    assert.match(card, /candidate\.source === 'coupang_search'/);
    assert.match(card, /rel="noopener noreferrer sponsored"/);
  });

  it('9. 관리자 통계 3종: 실측/공간맞춤 = fit 대상, 치수검증중 = REVIEW, 공개 고유상품 = unique productId', () => {
    const catalog = buildPublicCatalog([...SEEDS, ...DB_DUPES], [...PENDING, ...REVIEW_FILE], SEED_PAGE_KEYS);
    const stats = publicCatalogStats(catalog);
    assert.deepEqual(stats, {
      fitTargets: catalog.verified.length,
      review: catalog.review.length,
      uniqueProductIds: catalog.uniqueProductIds,
    });
    assert.equal(stats.fitTargets, 3, 'seed 3 + DB 중복 2 → 중복 제거 후 3');
    const admin = stripComments(read('src/components/AdminTool.tsx'));
    assert.match(admin, /publicCatalogStats\(getPublicCatalog\(list\.filter\(\(p\) => p\.verified\)\)\)/);
    assert.match(admin, /label: '실측\/공간맞춤', value: publicStats\.fitTargets/);
    assert.match(admin, /label: '치수검증중', value: publicStats\.review/);
    assert.match(admin, /label: '공개 고유상품', value: publicStats\.uniqueProductIds/);
    // DB 관리 목록 숫자는 공개 카탈로그처럼 보이는 이름을 쓰지 않는다
    assert.doesNotMatch(admin, /label: '공개 상품'|`공개 상품 \$\{stats|'전체 관리'/);
    assert.match(admin, /관리 목록 \(DB \+ seed\)/);
  });

  it('공개 목록(홈 · SEO · 상세)은 dedupe 된 getLiveProducts 를 쓰고, 정리된 카드의 예전 링크는 남은 카드로 보낸다', () => {
    const live = stripComments(read('src/lib/liveCatalog.ts'));
    assert.match(live, /dedupeVerifiedByProductKey\(verifiedOnly\(await getAllLiveProducts\(\)\), SEED_PAGE_KEYS\)/);
    assert.match(live, /return \(await getLiveCatalog\(\)\)\.products;/);
    const page = stripComments(read('src/app/p/[id]/page.tsx'));
    assert.match(page, /permanentRedirect\(`\/p\/\$\{duplicate\.keptId\}`\)/);
  });
});

describe('이슈 #33 — Search call 43~45 net-new 16개', () => {
  // 이슈 #33 표(productId · itemId · vendorItemId · price)와 중앙 cache 원문(QA 댓글 5933671396 ~ 5933728658) 대조값
  const EXPECTED = {
    6382980894: ['desk', '13570126686', '80823558414', 107000],
    8101686888: ['desk', '27045180914', '94013609656', 59800],
    8936753970: ['desk', '26129920444', '94933242958', 89420],
    9200245528: ['desk', '27163506319', '95271081607', 128700],
    9425628558: ['desk', '28018169982', '94975762542', 45000],
    8952948948: ['washing_machine', '26189827080', '93169229448', 179000],
    9739138804: ['washing_machine', '29148373588', '96118625819', 26300],
    9746324256: ['washing_machine', '29177882871', '96099149627', 38850],
    9748766128: ['washing_machine', '29189168740', '96110150158', 149000],
    4882898698: ['microwave', '8865360607', '76152061617', 48390],
    6784715012: ['microwave', '15967393537', '5493101444', 59690],
    7660428989: ['microwave', '20407125459', '87489288057', 47990],
    7939925865: ['microwave', '21866009170', '91490322758', 199000],
    8505623426: ['microwave', '24618602585', '91629750061', 130940],
    8987450079: ['microwave', '26321612398', '93298993599', 60020],
    9626332974: ['microwave', '28749019506', '95688024846', 59000],
  };
  const CALL = { desk: [43, '원룸 좁은 책상'], washing_machine: [44, '원룸 소형 세탁기'], microwave: [45, '소형 전자레인지'] };
  const EXCLUDED = [9562701830, 9626345242, 9327614652, 8866141828, 9024025969, 9553004090];
  const rows = REVIEW_FILE.filter((r) => /이슈 #33/.test(r.note ?? ''));

  it('새 16개가 정확히 한 번씩 있고 그 밖의 행은 없다', () => {
    assert.deepEqual(rows.map((r) => r.productId).sort(), Object.keys(EXPECTED).map(Number).sort());
    for (const id of Object.keys(EXPECTED)) assert.equal(REVIEW_FILE.filter((r) => r.productId === Number(id)).length, 1, id);
  });

  it('제외 6개(운영 verified 중복 2 · 본체 아님 4)는 신규 데이터에 없다', () => {
    for (const id of EXCLUDED) assert.equal(rows.some((r) => r.productId === id), false, String(id));
    for (const id of [9327614652, 8866141828, 9024025969, 9553004090]) {
      assert.equal(REVIEW_FILE.some((r) => r.productId === id), false, String(id));
    }
  });

  it('itemId · vendorItemId · price · category · keyword 가 이슈 표 · cache 원문과 같고 URL 과도 일치한다', () => {
    for (const row of rows) {
      const [category, itemId, vendorItemId, price] = EXPECTED[row.productId];
      assert.deepEqual([row.category, row.itemId, row.vendorItemId, row.price], [category, itemId, vendorItemId, price], String(row.productId));
      assert.equal(row.source, 'coupang_search');
      assert.equal(row.priceCheckedAt, '2026-10-01');
      assert.equal(row.keyword, CALL[category][1]);
      assert.match(row.note, new RegExp(`Search call ${CALL[category][0]} `));
      assert.match(row.note, /V0-153 Search URL — 저장 provenance 전용, CTA 금지/);
      const url = new URL(row.coupangUrl);
      assert.equal(url.origin + url.pathname, 'https://link.coupang.com/re/AFFSDP');
      assert.equal(url.searchParams.get('pageKey'), String(row.productId));
      assert.equal(url.searchParams.get('itemId'), itemId);
      assert.equal(url.searchParams.get('vendorItemId'), vendorItemId);
      assert.match(url.searchParams.get('traceid'), /^V0-153-[0-9a-f]+$/);
      assert.equal(url.searchParams.has('subid'), false);
      for (const key of FORBIDDEN_REVIEW_KEYS) assert.equal(key in row, false, `${row.productId} ${key}`);
    }
  });

  it('16개 모두 https 이미지 · identity guard 통과로 공개되고, CTA 는 비활성(구매 링크 검증 중)', () => {
    const repo = loadRepoCatalog();
    for (const row of rows) {
      assert.ok(hasPublicImage(row.imageUrl), String(row.productId));
      assert.equal(categoryIdentityRejection(row.productId, row.name, row.category), null, row.name);
      const shown = repo.review.find((c) => c.productId === row.productId);
      assert.ok(shown, String(row.productId));
      assert.equal(Object.prototype.hasOwnProperty.call(REGISTRY.landingByProductId, String(row.productId)), false);
      const { href } = resolveCoupangCta({ id: `cp-${row.productId}`, coupangUrl: row.coupangUrl, productId: row.productId }, REGISTRY);
      assert.equal(href, null, String(row.productId));
    }
    assert.equal(repo.review.filter((c) => !hasPublicImage(c.imageUrl)).length, 0, '공개 이미지 공백 0');
  });

  it('반영 후 공개 unique 101 · desk 10 · washing_machine 9 · microwave 13, 나머지 카테고리는 그대로', () => {
    const repo = loadRepoCatalog();
    assert.equal(repo.uniqueProductIds, 101);
    const expected = { refrigerator: 8, washing_machine: 9, dryer: 8, dishwasher: 7, microwave: 13, desk: 10, folding_table: 6, niche: 7, bed: 8, sofa: 9, hanger: 9, shoe_rack: 7 };
    for (const tab of PUBLIC_TABS) assert.equal(uniqueProductIdsFor(repo, tab.allowed, SEED_PAGE_KEYS), expected[tab.id], tab.id);
    const verifiedIds = new Set(repo.verified.map((p) => p.id));
    for (const row of rows) assert.equal(verifiedIds.has(`cp-${row.productId}`), false, 'REVIEW 는 fit 대상(verified)에 없다');
  });
});
