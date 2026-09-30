/**
 * 쿠팡 파트너스 경제적 이해관계 고지.
 *
 * - 공식 문구 그대로, AFFILIATE_NOTICE 하나에서만 관리한다.
 * - 쿠팡 CTA 가 있는 공개 상품 화면(홈 결과 목록 · 상품 상세)에서 상품/CTA 보다 먼저 1회 표시한다.
 * - ProductCard 마다 반복하지 않는다.
 * - 푸터에는 고지를 두지 않는다. 고지는 상품 목록 · 상세 위에서만 한다.
 * - 쿠팡 CTA 의 href/target/rel 은 바꾸지 않는다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { AFFILIATE_NOTICE } from '../src/lib/siteInfo.ts';

const OFFICIAL = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function collect(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, found);
    else if (entry.endsWith('.tsx')) found.push(full);
  }
  return found;
}

/** 공개 화면 파일(관리자 화면 제외) */
const publicSources = collect(join(ROOT, 'src'))
  .map((path) => ({ path: relative(ROOT, path), code: stripComments(readFileSync(path, 'utf8')) }))
  .filter((f) => !/admin|Admin|PendingQueue/.test(f.path));

/** 쿠팡 CTA 를 직접 그리는 카드/상세 컴포넌트와 목록 컴포넌트 자체 */
const RENDERERS = new Set([
  'src/components/ProductCard.tsx',
  'src/components/ProductGrid.tsx',
  'src/components/ProductDetail.tsx',
  'src/components/AffiliateNotice.tsx',
]);

describe('쿠팡 파트너스 고지 문구', () => {
  it('공식 문구와 정확히 같다', () => {
    assert.equal(AFFILIATE_NOTICE, OFFICIAL);
  });

  it('문구는 siteInfo 상수 한 곳에만 있다(런타임 소스 하드코딩 없음)', () => {
    const holders = collect(join(ROOT, 'src'))
      .concat(join(ROOT, 'src/lib/siteInfo.ts'))
      .map((path) => relative(ROOT, path))
      .filter((path) => read(path).includes(OFFICIAL));
    assert.deepEqual(holders, ['src/lib/siteInfo.ts']);
  });

  it('고지 컴포넌트는 상수를 쓰고 숨기지 않으며 14px 이상이다', () => {
    const code = stripComments(read('src/components/AffiliateNotice.tsx'));
    assert.match(code, /\{AFFILIATE_NOTICE\}/);
    assert.match(code, /role="note"/);
    assert.doesNotMatch(code, /aria-hidden|\bhidden\b|sr-only|text-\[1[0-3](\.\d+)?px\]|text-xs/);
    assert.match(code, /text-sm/); // 14px
    assert.match(code, /border /);
    assert.match(code, /bg-brand-50/);
  });
});

describe('노출 위치', () => {
  it('ProductGrid / ProductDetail 을 쓰는 모든 공개 화면이 그보다 앞에서 고지를 1회 렌더한다', () => {
    const surfaces = publicSources
      .filter((f) => !RENDERERS.has(f.path))
      .filter((f) => /<(ProductGrid|ProductDetail|ProductCard)\b/.test(f.code));
    assert.deepEqual(
      surfaces.map((f) => f.path).sort(),
      ['src/app/p/[id]/page.tsx', 'src/components/SizeFinderApp.tsx'],
    );
    for (const { path, code } of surfaces) {
      const noticeAt = code.indexOf('<AffiliateNotice');
      const productAt = code.search(/<(ProductGrid|ProductDetail|ProductCard)\b/);
      assert.ok(noticeAt > -1, `${path}: 상품 목록 위 고지가 없다`);
      assert.ok(noticeAt < productAt, `${path}: 고지가 상품보다 뒤에 있다`);
      assert.equal(code.split('<AffiliateNotice').length - 1, 1, `${path}: 고지 중복`);
    }
  });

  it('ProductCard 는 있는데 목록 상단 고지가 없는 상태를 막는다 — 카드/그리드 내부에는 고지를 넣지 않는다', () => {
    for (const path of ['src/components/ProductCard.tsx', 'src/components/ProductGrid.tsx', 'src/components/ProductDetail.tsx']) {
      assert.doesNotMatch(read(path), /AffiliateNotice|AFFILIATE_NOTICE/, path);
    }
    const app = stripComments(read('src/components/SizeFinderApp.tsx'));
    assert.match(app, /visible\.length > 0 && <AffiliateNotice/);
  });

  it('푸터에는 고지를 두지 않는다(상품 목록 위 고지는 위 테스트가 강제한다)', () => {
    assert.doesNotMatch(read('src/components/Footer.tsx'), /AFFILIATE_NOTICE|AffiliateNotice/);
  });
});

describe('쿠팡 CTA 불변', () => {
  it('카드 · 상세 CTA 의 target / rel 이 그대로다 (href 는 exact tracked canonical resolver 결과)', () => {
    for (const path of ['src/components/ProductCard.tsx', 'src/components/ProductDetail.tsx']) {
      const code = read(path);
      assert.match(code, /href=\{coupangHref\}\s*target="_blank"\s*rel="noopener noreferrer sponsored"/, path);
    }
  });
});
