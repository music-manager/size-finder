/**
 * 공개 쿠팡 CTA — exact tracked canonical.
 *
 * - 저장된 identity(pageKey · itemId · vendorItemId)와 추적값(lptag · subid · traceid)만 쓴다.
 *   subid 를 새로 만들지 않는다. 추측·보완 금지.
 * - 검색 URL · 단축 /a/ · coupa.ng 은 해석하지 않고 null.
 * - 반환 URL 파라미터는 itemId · vendorItemId · lptag · subid · traceid 뿐.
 * - null 이면 공개 화면은 외부 링크 대신 "구매 링크 검증 중" 을 보인다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  CMPICK_SUBID,
  buildTrackedCanonical,
  resolveCoupangTrackedHref,
} from '../src/lib/coupangCta.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

const REGISTRY = readJson('src/data/coupang-cta-provenance.json');
const PRODUCTS = readJson('src/data/products.json');

// Search API 원본 형식: exact 3-tuple 은 있지만 subid 가 없고 traceid 는 Search 단계 값(V0-153)
const RAW_SEARCH_AFFSDP =
  'https://link.coupang.com/re/AFFSDP?lptag=AF3873783&pageKey=8090724268&itemId=24880186317&vendorItemId=91886979841&traceid=V0-153-e7d7dbd94ea4b733&requestid=20260925035143008179404058&token=31850C%7CMIXED&pt=0&slot=6';
// Deep Link landing 에 저장된 형식: subid=cmpick + V0-183 (src · spec · token 등은 버려야 한다)
const STORED_LANDING =
  'https://www.coupang.com/vp/products/8090724268?itemId=24880186317&vendorItemId=91886979841&src=1139000&spec=10799999&addtag=400&ctag=8090724268&lptag=AF3873783&subid=cmpick&traceid=V0-183-e7d7dbd94ea4b733&requestid=20260930000000000000000000&token=31850C%7CMIXED&clickBeacon=abc%7E3';
const STORED_AFFSDP =
  'https://link.coupang.com/re/AFFSDP?lptag=AF3873783&pageKey=8090724268&itemId=24880186317&vendorItemId=91886979841&subid=cmpick&traceid=V0-183-e7d7dbd94ea4b733&clickBeacon=abc%7E3&requestid=1&token=31850C%7CMIXED&pt=1&slot=5';
const EXPECTED =
  'https://www.coupang.com/vp/products/8090724268?itemId=24880186317&vendorItemId=91886979841&lptag=AF3873783&subid=cmpick&traceid=V0-183-e7d7dbd94ea4b733';

const IDENTITY = {
  pageKey: '8090724268',
  itemId: '24880186317',
  vendorItemId: '91886979841',
  lptag: 'AF3873783',
  subid: 'cmpick',
  traceid: 'V0-183-e7d7dbd94ea4b733',
};

const product = (coupangUrl, extra = {}) => ({ id: 'cp-test', coupangUrl, ...extra });
const resolve = (coupangUrl, extra) => resolveCoupangTrackedHref(product(coupangUrl, extra), REGISTRY);
const resolveById = (id) => {
  const found = PRODUCTS.find((p) => p.id === id);
  assert.ok(found, `${id} 가 products.json 에 없다`);
  return resolveCoupangTrackedHref(found, REGISTRY);
};
const withParam = (url, key, value) => {
  const u = new URL(url);
  if (value === null) u.searchParams.delete(key);
  else u.searchParams.set(key, value);
  return u.toString();
};
const allPending = () =>
  readdirSync(join(ROOT, 'src/data'))
    .filter((f) => /^pending.*\.json$/.test(f))
    .flatMap((f) => readJson(`src/data/${f}`));

describe('resolver — 저장된 추적값만 쓴다', () => {
  it('subid 없는 raw Search AFFSDP → null (exact 3-tuple 이 있어도 subid 를 만들지 않는다)', () => {
    assert.equal(resolve(RAW_SEARCH_AFFSDP), null);
    assert.equal(resolve(RAW_SEARCH_AFFSDP, { productId: 8090724268 }), null);
  });

  it('V0-153 Search URL + subid 없음 → null', () => {
    assert.match(new URL(RAW_SEARCH_AFFSDP).searchParams.get('traceid'), /^V0-153-/);
    assert.equal(new URL(RAW_SEARCH_AFFSDP).searchParams.has('subid'), false);
    assert.equal(resolve(RAW_SEARCH_AFFSDP), null);
  });

  it('1. 저장된 landing(subid=cmpick, V0-183) → tracked canonical', () => {
    assert.equal(resolve(STORED_LANDING), EXPECTED);
    assert.equal(resolve(STORED_AFFSDP), EXPECTED);
  });

  it('2. 이미 tracked canonical 이면 같은 identity 를 유지한다', () => {
    assert.equal(resolve(EXPECTED), EXPECTED);
    assert.equal(resolve(resolve(STORED_LANDING)), EXPECTED, '두 번 돌려도 같다');
  });

  it('3~6. pageKey · itemId · vendorItemId · lptag · subid · traceid 를 저장값 그대로 보존', () => {
    const out = new URL(resolve(STORED_LANDING));
    assert.equal(out.origin, 'https://www.coupang.com');
    assert.equal(out.pathname, '/vp/products/8090724268');
    assert.equal(out.searchParams.get('itemId'), '24880186317');
    assert.equal(out.searchParams.get('vendorItemId'), '91886979841');
    assert.equal(out.searchParams.get('lptag'), 'AF3873783');
    assert.equal(out.searchParams.get('subid'), CMPICK_SUBID);
    assert.equal(out.searchParams.get('traceid'), 'V0-183-e7d7dbd94ea4b733');
    assert.equal(CMPICK_SUBID, 'cmpick');
  });

  it('7~9. requestid · token · clickBeacon (및 slot · pt · src · spec · addtag · ctag) 는 제거된다', () => {
    for (const source of [STORED_LANDING, STORED_AFFSDP]) {
      const out = new URL(resolve(source));
      for (const key of ['requestid', 'token', 'clickBeacon', 'slot', 'pt', 'src', 'spec', 'addtag', 'ctag', 'pageKey']) {
        assert.equal(out.searchParams.has(key), false, `${key} 가 남아 있다`);
      }
      assert.deepEqual(
        [...out.searchParams.keys()],
        ['itemId', 'vendorItemId', 'lptag', 'subid', 'traceid'],
      );
    }
  });

  it('productId 가 pageKey 와 같으면 허용한다 (숫자 · 문자열 모두)', () => {
    assert.equal(resolve(STORED_LANDING, { productId: 8090724268 }), EXPECTED);
    assert.equal(resolve(STORED_LANDING, { productId: '8090724268' }), EXPECTED);
  });
});

describe('resolver — 거부되는 입력 (null)', () => {
  it('10. /np/search → null', () => {
    assert.equal(resolve('https://www.coupang.com/np/search?q=%EB%AF%B8%EB%8B%88%EA%B1%B4%EC%A1%B0%EA%B8%B0'), null);
  });

  it('11. link.coupang.com/a/… → null', () => {
    assert.equal(resolve('https://link.coupang.com/a/hccXPGgZbg'), null);
    assert.equal(resolve('https://link.coupang.com/a/haKLrWKw0q?pageKey=1&itemId=2&vendorItemId=3&lptag=x&subid=cmpick&traceid=y'), null);
  });

  it('12. coupa.ng/… → null', () => {
    assert.equal(resolve('https://coupa.ng/cabc12'), null);
  });

  it('13. vendorItemId 없음 → null', () => {
    assert.equal(resolve(withParam(STORED_AFFSDP, 'vendorItemId', null)), null);
    assert.equal(resolve(withParam(STORED_LANDING, 'vendorItemId', null)), null);
  });

  it('14. itemId 없음 → null', () => {
    assert.equal(resolve(withParam(STORED_AFFSDP, 'itemId', null)), null);
    assert.equal(resolve(withParam(STORED_LANDING, 'itemId', null)), null);
  });

  it('lptag · subid · traceid · pageKey 없음 → null', () => {
    for (const key of ['lptag', 'subid', 'traceid', 'pageKey']) {
      assert.equal(resolve(withParam(STORED_AFFSDP, key, null)), null, `AFFSDP ${key}`);
    }
    for (const key of ['lptag', 'subid', 'traceid']) {
      assert.equal(resolve(withParam(STORED_LANDING, key, null)), null, `landing ${key}`);
    }
  });

  it('숫자가 아닌 identity · 빈 값 · 중복 키 → null', () => {
    assert.equal(resolve(withParam(STORED_AFFSDP, 'vendorItemId', 'abc')), null);
    assert.equal(resolve(withParam(STORED_AFFSDP, 'itemId', '')), null);
    assert.equal(resolve(withParam(STORED_AFFSDP, 'lptag', '')), null);
    assert.equal(resolve(`${STORED_AFFSDP}&vendorItemId=11111111111`), null, '같은 키가 두 번');
    assert.equal(resolve(`${STORED_LANDING}&subid=cmpick`), null, 'subid 두 번');
    assert.equal(resolve(`${EXPECTED}&pageKey=1`), null, 'canonical path 와 다른 pageKey');
  });

  it('15. malformed URL → null', () => {
    for (const bad of ['', '   ', 'not a url', 'link.coupang.com/re/AFFSDP?pageKey=1', 'javascript:alert(1)', undefined, null]) {
      assert.equal(resolve(bad), null, String(bad));
    }
    assert.equal(resolve(STORED_AFFSDP.replace('https://', 'http://')), null, 'http');
    assert.equal(resolve(STORED_AFFSDP.replace('link.coupang.com', 'link.coupang.com.evil.example')), null, 'host');
    assert.equal(resolve(EXPECTED.replace('www.coupang.com', 'm.coupang.com')), null, '다른 host');
    assert.equal(resolve(EXPECTED.replace('/vp/products/', '/vp/products/x')), null, 'path');
  });

  it('16. product.productId 와 pageKey 불일치 → null', () => {
    assert.equal(resolve(STORED_LANDING, { productId: 8090724269 }), null);
    assert.equal(resolve(EXPECTED, { productId: 1 }), null);
  });

  it('17. 다른 subid → null', () => {
    assert.equal(resolve(withParam(STORED_AFFSDP, 'subid', 'kkultem')), null);
    assert.equal(resolve(withParam(EXPECTED, 'subid', 'vehicle')), null);
    assert.equal(resolve(withParam(EXPECTED, 'subid', '')), null);
    assert.equal(resolve(withParam(EXPECTED, 'subid', 'CMPICK')), null);
  });
});

describe('explicit provenance registry', () => {
  it('seedById 에는 검증된 2건(dry-006 · dry-007)만 있다', () => {
    assert.deepEqual(Object.keys(REGISTRY.seedById).sort(), ['dry-006', 'dry-007']);
    for (const id of Object.keys(REGISTRY.seedById)) {
      const found = PRODUCTS.find((p) => p.id === id);
      assert.ok(found?.verified, `${id} 는 verified seed 여야 한다`);
    }
  });

  it('registry 의 모든 항목은 저장값 6개가 다 있고 subid=cmpick 이며 canonical 을 만든다', () => {
    const entries = [
      ...Object.entries(REGISTRY.seedById ?? {}),
      ...Object.entries(REGISTRY.landingByProductId ?? {}),
    ];
    for (const [key, identity] of entries) {
      assert.deepEqual(
        Object.keys(identity).sort(),
        ['itemId', 'lptag', 'pageKey', 'subid', 'traceid', 'vendorItemId'],
        key,
      );
      assert.equal(identity.subid, 'cmpick', key);
      assert.ok(buildTrackedCanonical(identity), `${key}: canonical 을 만들지 못한다`);
    }
  });

  it('landingByProductId 의 키는 각 항목의 pageKey(= DB productId)와 정확히 같다', () => {
    for (const [key, identity] of Object.entries(REGISTRY.landingByProductId ?? {})) {
      assert.equal(identity.pageKey, key);
    }
  });

  it('18. dry-006 → 정확한 tracked canonical', () => {
    assert.equal(
      resolveById('dry-006'),
      'https://www.coupang.com/vp/products/8321193275?itemId=24017964688&vendorItemId=91038553989&lptag=AF3873783&subid=cmpick&traceid=V0-183-27716418f5547a87',
    );
  });

  it('19. dry-007 → 정확한 tracked canonical', () => {
    assert.equal(resolveById('dry-007'), EXPECTED);
  });

  it('20. dry-008 → null (/a/ 단축 URL 만 있고 exact provenance 없음)', () => {
    const dry008 = PRODUCTS.find((p) => p.id === 'dry-008');
    assert.match(dry008.coupangUrl, /^https:\/\/link\.coupang\.com\/a\//);
    assert.equal(resolveById('dry-008'), null);
  });

  it('seed 가 있어도 productId 가 pageKey 와 다르면 null', () => {
    const seed = { ...PRODUCTS.find((p) => p.id === 'dry-006'), productId: 1 };
    assert.equal(resolveCoupangTrackedHref(seed, REGISTRY), null);
  });

  it('landing provenance: productId 로 찾고, 원본이 raw Search URL 이어도 저장된 landing 값을 쓴다', () => {
    const registry = { landingByProductId: { 8090724268: IDENTITY } };
    const dbProduct = product(RAW_SEARCH_AFFSDP, { id: 'db-row', productId: 8090724268 });
    assert.equal(resolveCoupangTrackedHref(dbProduct, registry), EXPECTED);
  });

  it('landing provenance 키와 pageKey 가 다르면 null', () => {
    const registry = { landingByProductId: { 8090724268: { ...IDENTITY, pageKey: '8090724269' } } };
    const dbProduct = product(RAW_SEARCH_AFFSDP, { id: 'db-row', productId: 8090724268 });
    assert.equal(resolveCoupangTrackedHref(dbProduct, registry), null);
  });

  it('landing provenance 에 subid 가 없거나 다르면 null (registry 도 subid 를 만들지 않는다)', () => {
    const { subid, ...noSubid } = IDENTITY;
    assert.equal(subid, 'cmpick');
    for (const bad of [noSubid, { ...IDENTITY, subid: 'kkultem' }]) {
      const registry = { landingByProductId: { 8090724268: bad } };
      const dbProduct = product(RAW_SEARCH_AFFSDP, { id: 'db-row', productId: 8090724268 });
      assert.equal(resolveCoupangTrackedHref(dbProduct, registry), null);
    }
  });

  it('repo 60건 inventory: search-only 57 · exact seed 2 · unresolved /a 1', () => {
    assert.equal(PRODUCTS.length, 60);
    const resolved = PRODUCTS.filter((p) => resolveCoupangTrackedHref(p, REGISTRY));
    const search = PRODUCTS.filter((p) => p.coupangUrl.startsWith('https://www.coupang.com/np/search'));
    const shortA = PRODUCTS.filter((p) => p.coupangUrl.startsWith('https://link.coupang.com/a/'));
    assert.equal(search.length, 57);
    assert.ok(search.every((p) => resolveCoupangTrackedHref(p, REGISTRY) === null));
    assert.deepEqual(resolved.map((p) => p.id).sort(), ['dry-006', 'dry-007']);
    assert.deepEqual(
      shortA.filter((p) => !resolveCoupangTrackedHref(p, REGISTRY)).map((p) => p.id),
      ['dry-008'],
    );
  });

  it('provenance 없는 DB 형식 상품(raw Search AFFSDP, subid 없음)은 clickable CTA 0', () => {
    const landing = REGISTRY.landingByProductId ?? {};
    const raw = allPending().filter((p) => p.coupangUrl.startsWith('https://link.coupang.com/re/AFFSDP'));
    assert.ok(raw.length > 0);
    const withoutProvenance = raw.filter((p) => !Object.prototype.hasOwnProperty.call(landing, String(p.productId)));
    assert.ok(withoutProvenance.length > 0);
    const clickable = withoutProvenance.filter((p) => resolveCoupangTrackedHref(p, REGISTRY) !== null);
    assert.deepEqual(clickable.map((p) => p.id), []);
  });
});

describe('공개 CTA 렌더', () => {
  const COMPONENTS = ['src/components/ProductCard.tsx', 'src/components/ProductDetail.tsx'];

  it('21~22. ProductCard · ProductDetail 은 coupangUrl 을 href 로 쓰지 않는다', () => {
    for (const path of COMPONENTS) {
      const code = read(path);
      assert.doesNotMatch(code, /href=\{product\.coupangUrl\}/, path);
      assert.doesNotMatch(code, /coupangUrl/, `${path}: coupangUrl 을 직접 참조한다`);
      assert.match(code, /import \{ coupangCtaHref \} from '@\/lib\/coupangCtaLinks'/, path);
      assert.match(code, /const coupangHref = coupangCtaHref\(product\)/, path);
    }
  });

  it('23. href 가 null 이면 외부 링크(<a>)를 렌더하지 않고 "구매 링크 검증 중" 만 보인다', () => {
    for (const path of COMPONENTS) {
      const code = read(path);
      const start = code.indexOf('{coupangHref ? (');
      assert.ok(start > -1, `${path}: coupangHref 분기가 없다`);
      const mid = code.indexOf(') : (', start);
      const end = code.indexOf(')}', mid);
      assert.ok(mid > start && end > mid, `${path}: 분기 구조를 찾지 못했다`);

      const safe = code.slice(start, mid);
      const unsafe = code.slice(mid, end);
      const anchors = [...code.matchAll(/<a[\s>]/g)].map((m) => m.index);
      assert.equal(anchors.length, 1, `${path}: 외부 <a> 는 CTA 하나뿐이어야 한다`);
      assert.ok(anchors[0] > start && anchors[0] < mid, `${path}: <a> 가 safe 분기 밖에 있다`);
      assert.match(safe, /href=\{coupangHref\}\s*target="_blank"\s*rel="noopener noreferrer sponsored"/, path);

      assert.match(unsafe, /구매 링크 검증 중/, path);
      assert.doesNotMatch(unsafe, /<a[\s>]|<Link\b|href=|onClick|role="link"|window\./, `${path}: unsafe 분기가 클릭 가능하다`);
    }
  });
});
