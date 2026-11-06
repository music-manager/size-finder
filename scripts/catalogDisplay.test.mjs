/**
 * P1 안전 수정 — 표시 숫자 · 반응형 문구 · HTML 보안 헤더.
 *
 * - 홈 탭 숫자(사용자 표시) = 공개 카드 수(verified + review). productId 없는 실측 카드도 센다.
 *   고유 productId 수(uniqueProductIdsFor)는 catalog:gate · 1,000 목표용 내부 기준으로 그대로 둔다.
 * - 검색창 placeholder 는 사이드바 폭(1440px 기준 약 206px)에 들어가는 길이.
 * - 가격 기준일(YYYY.MM 기준)은 줄바꿈하지 않는다.
 * - SSR HTML 응답에도 netlify.toml 과 같은 Referrer-Policy · X-Frame-Options.
 * 기대값은 DB 없는 fail-soft 공개 카탈로그(sitemap.test.mjs 와 같은 경로)에서 파생한다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { appendVerifiedBatch, buildVerifiedBatchProducts } from '../src/lib/verifiedBatch.ts';
import {
  buildPublicCatalog,
  dedupeVerifiedByProductKey,
  isPublicIncompleteProductId,
  publicCountFor,
  uniqueProductIdsFor,
  verifiedProductKey,
} from '../src/lib/publicCatalog.ts';
import { PUBLIC_TABS } from './catalog-gate.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const REGISTRY = readJson('src/data/coupang-cta-provenance.json');
const SEED_PAGE_KEYS = Object.fromEntries(Object.entries(REGISTRY.seedById).map(([id, i]) => [id, i.pageKey]));
const keyOf = (p) => verifiedProductKey(p, SEED_PAGE_KEYS);
const RECORDS = readJson('src/data/review-candidates.json');
const PENDING = readdirSync(new URL('../src/data', import.meta.url))
  .filter((f) => /^pending.*\.json$/.test(f))
  .sort()
  .flatMap((f) => readJson(`src/data/${f}`));
const SEEDS = readJson('src/data/products.json').filter((p) => p.verified);
const BATCH = buildVerifiedBatchProducts(readJson('src/data/verified-batch-44.json'), RECORDS);

// getLiveProducts() (DB 없음) → getPublicCatalog() 와 같은 순서
const { kept: LIVE } = dedupeVerifiedByProductKey(
  appendVerifiedBatch(SEEDS, BATCH, keyOf).filter((p) => !isPublicIncompleteProductId(p.productId)),
  SEED_PAGE_KEYS,
);
const CATALOG = buildPublicCatalog(appendVerifiedBatch(LIVE, BATCH, keyOf), [...PENDING, ...RECORDS], SEED_PAGE_KEYS);

describe('홈 탭 숫자 = 공개 카드 수', () => {
  it('전체 탭 = VERIFIED 카드 + REVIEW 카드', () => {
    const total = publicCountFor(CATALOG, null);
    assert.equal(total, CATALOG.verified.length + CATALOG.review.length);
    assert.ok(CATALOG.verified.length > 50 && CATALOG.review.length > 50, `${CATALOG.verified.length}/${CATALOG.review.length}`);
  });

  it('productId 없는 공개 seed(dry-008)도 표시 숫자에 들어가고, 내부 고유 productId 수에는 빠진다', () => {
    const dry008 = CATALOG.verified.find((p) => p.id === 'dry-008');
    assert.ok(dry008, 'dry-008 공개 카드');
    assert.equal(keyOf(dry008), null);
    const keyless = CATALOG.verified.filter((p) => keyOf(p) === null).map((p) => p.id);
    assert.deepEqual(keyless, ['dry-008']);
    // 표시 숫자 - 내부 고유 수 = productId 를 알 수 없는 공개 카드 수
    assert.equal(publicCountFor(CATALOG, null) - uniqueProductIdsFor(CATALOG, null, SEED_PAGE_KEYS), keyless.length);
    const dryerTab = PUBLIC_TABS.find((t) => t.id === 'dryer');
    assert.equal(
      publicCountFor(CATALOG, dryerTab.allowed) - uniqueProductIdsFor(CATALOG, dryerTab.allowed, SEED_PAGE_KEYS),
      1,
    );
  });

  it('카테고리 탭 숫자 = 그 탭 카드 수, 탭 합 = 전체 (전체 제외 12탭)', () => {
    let sum = 0;
    for (const tab of PUBLIC_TABS) {
      const n = publicCountFor(CATALOG, tab.allowed);
      assert.equal(
        n,
        CATALOG.verified.filter((p) => tab.allowed.includes(p.category)).length +
          CATALOG.review.filter((c) => tab.allowed.includes(c.category)).length,
        tab.id,
      );
      sum += n;
    }
    assert.equal(sum, publicCountFor(CATALOG, null));
  });

  it('VERIFIED · REVIEW 에 같은 productId 가 있으면 내부 고유 수는 1, 표시 수는 카드 수 (내부 검증 유지)', () => {
    const dup = { verified: [{ ...CATALOG.verified.find((p) => keyOf(p) !== null) }], review: [] };
    dup.review.push({ ...CATALOG.review[0], productId: keyOf(dup.verified[0]), category: dup.verified[0].category });
    assert.equal(uniqueProductIdsFor(dup, null, SEED_PAGE_KEYS), 1);
    assert.equal(publicCountFor(dup, null), 2);
  });

  it('SizeFinderApp 탭 숫자는 publicCountFor, catalog:gate 는 uniqueProductIdsFor 를 그대로 쓴다', () => {
    const app = stripComments(read('src/components/SizeFinderApp.tsx'));
    assert.match(app, /result\[category\.id\] = publicCountFor\(publicCatalog, CATEGORY_MATCH\[category\.id\]\)/);
    assert.doesNotMatch(app, /uniqueProductIdsFor/);
    assert.match(read('scripts/catalog-gate.mjs'), /uniqueProductIdsFor\(catalog, t\.allowed, seedPageKeys\)/);
    assert.match(read('src/lib/publicCatalog.ts'), /export function uniqueProductIdsFor\(/);
  });
});

describe('검색창', () => {
  const src = read('src/components/SearchBar.tsx');

  it('placeholder 는 짧은 문구, 검색 동작 · 접근성 이름은 그대로', () => {
    assert.match(src, /placeholder="모델명·브랜드 검색"/);
    assert.doesNotMatch(src, /예: 위니아/);
    assert.match(src, /aria-label="모델명 또는 브랜드 검색"/);
    assert.match(src, /type="search"/);
    assert.match(src, /onChange=\{\(event\) => onChange\(event\.target\.value\)\}/);
    assert.match(src, /onClick=\{\(\) => onChange\(''\)\}/);
  });
});

describe('가격 기준일 한 줄', () => {
  it('카드 · 상세의 기준일 span 은 whitespace-nowrap, 카드 가격 줄은 자리가 없으면 통째로 넘긴다', () => {
    for (const file of ['src/components/ProductCard.tsx', 'src/components/ReviewCard.tsx']) {
      const src = read(file);
      assert.match(src, /<p className="flex flex-wrap items-baseline gap-1">/, file);
      assert.match(src, /<span className="ml-auto whitespace-nowrap text-\[9px\] text-slate-400">\s*\{formatCheckedAt\(/, file);
    }
    assert.match(
      read('src/components/ProductDetail.tsx'),
      /<span className="ml-1 whitespace-nowrap text-\[11px\] text-slate-400">\s*\{formatCheckedAt\(/,
    );
  });
});

describe('HTML 보안 헤더', () => {
  const config = read('next.config.mjs');
  const netlify = read('netlify.toml');
  const tomlValue = (key) => netlify.match(new RegExp(`^\\s*${key} = "([^"]+)"`, 'm'))?.[1];
  const configValue = (key) => config.match(new RegExp(`\\{ key: '${key}', value: '([^']+)' \\}`))?.[1];

  it('Next 응답 전체(/:path*)에 netlify.toml 과 같은 Referrer-Policy · X-Frame-Options', () => {
    assert.equal(tomlValue('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.equal(tomlValue('X-Frame-Options'), 'SAMEORIGIN');
    assert.equal(configValue('Referrer-Policy'), tomlValue('Referrer-Policy'));
    assert.equal(configValue('X-Frame-Options'), tomlValue('X-Frame-Options'));
    assert.match(config, /return \[\{ source: '\/:path\*', headers: SECURITY_HEADERS \}\];/);
  });

  it('CSP 는 이번에 추가하지 않고, 이미지 remotePatterns 는 그대로', () => {
    assert.doesNotMatch(config, /Content-Security-Policy/i);
    assert.doesNotMatch(netlify, /Content-Security-Policy/i);
    assert.match(config, /\{ protocol: 'https', hostname: '\*\.coupangcdn\.com' \}/);
    assert.match(config, /\{ protocol: 'https', hostname: 'ads-partners\.coupang\.com', pathname: '\/image1\/\*\*' \}/);
  });
});
