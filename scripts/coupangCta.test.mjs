/**
 * 공개 쿠팡 CTA — exact tracked canonical.
 *
 * - Deep Link provenance(V0-183)가 있으면 tracked canonical을 우선한다.
 * - provenance가 없더라도 중앙 Search API가 실제 저장한 exact AFFSDP(V0-153)는
 *   productId와 pageKey가 일치할 때 원문 그대로 fallback CTA로 허용한다.
 * - 값을 새로 만들거나 subid를 합성하지 않는다.
 * - /np/search · 단축 /a/ · coupa.ng 은 해석하지 않는다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  CMPICK_SUBID,
  buildTrackedCanonical,
  parseExplicitIdentity,
  resolveCoupangCta,
  resolveCoupangTrackedHref,
  resolveStoredSearchAffiliateHref,
  resolveVerifiedShortAffiliateHref,
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


const SEED_DRY007 = REGISTRY.seedById['dry-007'];

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
  it('subid 없는 raw Search AFFSDP는 productId가 exact 일 때 원문 fallback CTA가 된다', () => {
    // productId가 없으면 pageKey를 대조할 수 없으므로 여전히 null
    assert.equal(resolve(RAW_SEARCH_AFFSDP), null);
    const noLanding = { seedById: REGISTRY.seedById };
    const raw = resolveCoupangCta(product(RAW_SEARCH_AFFSDP, { productId: 8090724268 }), noLanding);
    assert.equal(raw.source, 'search-raw');
    assert.equal(raw.href, RAW_SEARCH_AFFSDP);
    // V0-183 landing provenance가 있으면 더 강한 provenance를 우선한다
    const viaRegistry = resolveCoupangCta(product(RAW_SEARCH_AFFSDP, { productId: 8090724268 }), REGISTRY);
    assert.equal(viaRegistry.source, 'landing');
    assert.match(new URL(viaRegistry.href).searchParams.get('traceid'), /^V0-183-/);
  });

  it('V0-153 fallback은 exact 저장 URL만 허용한다', () => {
    assert.match(new URL(RAW_SEARCH_AFFSDP).searchParams.get('traceid'), /^V0-153-/);
    assert.equal(new URL(RAW_SEARCH_AFFSDP).searchParams.has('subid'), false);
    assert.equal(resolveStoredSearchAffiliateHref(RAW_SEARCH_AFFSDP, '8090724268'), RAW_SEARCH_AFFSDP);
    assert.equal(resolveStoredSearchAffiliateHref(RAW_SEARCH_AFFSDP, '8090724269'), null, 'pageKey 불일치');
    assert.equal(resolveStoredSearchAffiliateHref(RAW_SEARCH_AFFSDP.replace('AF3873783', 'AF0000000'), '8090724268'), null, '다른 lptag');
    assert.equal(resolveStoredSearchAffiliateHref(RAW_SEARCH_AFFSDP.replace('V0-153-', 'V0-999-'), '8090724268'), null, '다른 trace 단계');
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

  it('11. 일반 link.coupang.com/a/… → null (명시 allowlist 없이는 해석 금지)', () => {
    assert.equal(resolve('https://link.coupang.com/a/hccXPGgZbg'), null);
    assert.equal(resolve('https://link.coupang.com/a/haKLrWKw0q?pageKey=1&itemId=2&vendorItemId=3&lptag=x&subid=cmpick&traceid=y'), null);
    assert.equal(resolveVerifiedShortAffiliateHref('https://link.coupang.com/a/haKLrWKw0q?x=1'), null);
    assert.equal(resolveVerifiedShortAffiliateHref('http://link.coupang.com/a/haKLrWKw0q'), null);
    assert.equal(resolveVerifiedShortAffiliateHref('https://evil.example/a/haKLrWKw0q'), null);
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

  it('subid=cmpick 이 있어도 traceid 가 Search 단계(V0-153)면 null', () => {
    assert.equal(resolve(withParam(STORED_AFFSDP, 'traceid', 'V0-153-e7d7dbd94ea4b733')), null);
    assert.equal(resolve(withParam(STORED_LANDING, 'traceid', 'V0-153-e7d7dbd94ea4b733')), null);
    assert.equal(resolve(withParam(RAW_SEARCH_AFFSDP, 'subid', 'cmpick')), null);
  });

  it('traceid 는 저장된 Deep Link 형식(V0-183-{hex})만 허용: V0-999 · 임의 문자열 → null', () => {
    for (const bad of ['V0-999-e7d7dbd94ea4b733', 'foo', 'V0-183-', 'V0-183-E7D7DBD94EA4B733', 'V0-183-e7d7dbd94ea4b733-x', 'v0-183-e7d7dbd94ea4b733', 'X-V0-183-e7d7dbd94ea4b733']) {
      assert.equal(resolve(withParam(STORED_AFFSDP, 'traceid', bad)), null, `AFFSDP ${bad}`);
      assert.equal(resolve(withParam(STORED_LANDING, 'traceid', bad)), null, `landing ${bad}`);
      assert.equal(buildTrackedCanonical({ ...SEED_DRY007, traceid: bad }), null, `seed ${bad}`);
    }
    assert.equal(resolve(STORED_AFFSDP), EXPECTED, '정상 V0-183-hex 는 그대로 허용');
  });

  it('17. 다른 subid → null', () => {
    assert.equal(resolve(withParam(STORED_AFFSDP, 'subid', 'kkultem')), null);
    assert.equal(resolve(withParam(EXPECTED, 'subid', 'vehicle')), null);
    assert.equal(resolve(withParam(EXPECTED, 'subid', '')), null);
    assert.equal(resolve(withParam(EXPECTED, 'subid', 'CMPICK')), null);
  });
});

describe('explicit provenance registry', () => {
  const SEED = REGISTRY.seedById;
  const LANDING = REGISTRY.landingByProductId;
  const VERIFIED_SHORT = REGISTRY.verifiedShortById;
  const RAW_TEXT = read('src/data/coupang-cta-provenance.json');
  const landingIdentity = (key) => parseExplicitIdentity(LANDING[key]);
  // DB 행처럼: productId 만 있고 저장 URL 은 subid 없는 raw Search AFFSDP
  const dbRow = (key) => ({
    id: `db-${key}`,
    productId: Number(key),
    coupangUrl: `https://link.coupang.com/re/AFFSDP?lptag=AF3873783&pageKey=${key}&itemId=1&vendorItemId=1&traceid=V0-153-0000000000000000`,
  });

  it('seedById 에는 검증된 2건(dry-006 · dry-007)만 있다', () => {
    assert.deepEqual(Object.keys(SEED).sort(), ['dry-006', 'dry-007']);
    for (const id of Object.keys(SEED)) {
      const found = PRODUCTS.find((p) => p.id === id);
      assert.ok(found?.verified, `${id} 는 verified seed 여야 한다`);
    }
  });

  it('seed 항목은 저장값 6개가 다 있고 subid=cmpick · traceid=V0-183 이며 canonical 을 만든다', () => {
    for (const [id, identity] of Object.entries(SEED)) {
      assert.deepEqual(
        Object.keys(identity).sort(),
        ['itemId', 'lptag', 'pageKey', 'subid', 'traceid', 'vendorItemId'],
        id,
      );
      assert.equal(identity.subid, 'cmpick', id);
      assert.match(identity.traceid, /^V0-183-[0-9a-f]+$/, id);
      assert.ok(buildTrackedCanonical(identity), `${id}: canonical 을 만들지 못한다`);
    }
  });

  it('landingByProductId 는 정확히 16건이다 (JSON 원문 기준으로도 16)', () => {
    assert.equal(Object.keys(LANDING).length, 16);
    const section = RAW_TEXT.slice(RAW_TEXT.indexOf('"landingByProductId"'));
    assert.equal((section.match(/^\s*"\d+":\s*"/gm) ?? []).length, 16, 'JSON 원문의 키 수');
  });

  it('중복 없음: 원문 키 · URL · itemId · vendorItemId · traceid 가 모두 서로 다르다', () => {
    const section = RAW_TEXT.slice(RAW_TEXT.indexOf('"landingByProductId"'));
    const rawKeys = [...section.matchAll(/^\s*"(\d+)":\s*"/gm)].map((m) => m[1]);
    assert.equal(new Set(rawKeys).size, rawKeys.length, 'JSON 원문에 같은 키가 두 번 있다');
    const urls = Object.values(LANDING);
    const ids = Object.keys(LANDING).map(landingIdentity);
    for (const [label, values] of [
      ['url', urls],
      ['itemId', ids.map((i) => i.itemId)],
      ['vendorItemId', ids.map((i) => i.vendorItemId)],
      ['traceid', ids.map((i) => i.traceid)],
    ]) {
      assert.equal(new Set(values).size, values.length, `${label} 중복`);
    }
  });

  it('각 landing: 키 === URL pageKey, subid=cmpick, traceid=V0-183-*, lptag=AF3873783', () => {
    for (const [key, url] of Object.entries(LANDING)) {
      const params = new URL(url).searchParams;
      assert.equal(params.get('pageKey'), key, key);
      assert.equal(params.get('subid'), 'cmpick', key);
      assert.match(params.get('traceid'), /^V0-183-[0-9a-f]+$/, key);
      assert.equal(params.get('lptag'), 'AF3873783', key);
      const identity = landingIdentity(key);
      assert.ok(identity, `${key}: resolver 가 원문을 읽지 못한다`);
      assert.equal(identity.pageKey, key);
    }
  });

  it('각 landing 의 itemId · vendorItemId 가 repo 에 저장된 같은 productId 수집 기록과 일치한다', () => {
    const byProductId = new Map(allPending().map((p) => [String(p.productId), p]));
    let compared = 0;
    for (const key of Object.keys(LANDING)) {
      const record = byProductId.get(key);
      if (!record) continue;
      const stored = new URL(record.coupangUrl).searchParams;
      const identity = landingIdentity(key);
      assert.equal(identity.itemId, stored.get('itemId'), key);
      assert.equal(identity.vendorItemId, stored.get('vendorItemId'), key);
      compared += 1;
    }
    assert.equal(compared, 16, 'repo 수집 기록과 대조한 건수');
  });

  it('14. landing 16건은 DB 행(productId + raw Search URL)에서 source=landing 으로 tracked canonical 이 된다', () => {
    for (const [key, url] of Object.entries(LANDING)) {
      const result = resolveCoupangCta(dbRow(key), REGISTRY);
      assert.equal(result.source, 'landing', key);
      const source = new URL(url).searchParams;
      const out = new URL(result.href);
      assert.equal(out.pathname, `/vp/products/${key}`);
      assert.deepEqual(
        [...out.searchParams.entries()],
        [
          ['itemId', source.get('itemId')],
          ['vendorItemId', source.get('vendorItemId')],
          ['lptag', source.get('lptag')],
          ['subid', source.get('subid')],
          ['traceid', source.get('traceid')],
        ],
        key,
      );
    }
  });

  it('15. seed 2건은 source=seed 로 canonical 이고, 같은 상품의 중앙 landing 과 identity 가 정확히 같다', () => {
    for (const id of ['dry-006', 'dry-007']) {
      const seedProduct = PRODUCTS.find((p) => p.id === id);
      const viaSeed = resolveCoupangCta(seedProduct, REGISTRY);
      assert.equal(viaSeed.source, 'seed', id);
      const pageKey = SEED[id].pageKey;
      assert.ok(Object.prototype.hasOwnProperty.call(LANDING, pageKey), `${id}: 중앙 landing 에 같은 상품이 없다`);
      assert.deepEqual(landingIdentity(pageKey), SEED[id], `${id}: seed 와 landing identity 불일치`);
      const viaLanding = resolveCoupangCta(dbRow(pageKey), REGISTRY);
      assert.equal(viaLanding.source, 'landing', id);
      assert.equal(viaSeed.href, viaLanding.href, `${id}: 경로별 href 가 다르다`);
    }
  });

  it('provenance 경로 18개(seed 2 + landing 16)는 서로 다른 상품 16개다 (seed 2 는 landing 과 겹친다)', () => {
    const seedKeys = Object.values(SEED).map((i) => i.pageKey);
    const landingKeys = Object.keys(LANDING);
    assert.equal(seedKeys.length + landingKeys.length, 18);
    assert.equal(new Set([...seedKeys, ...landingKeys]).size, 16);
    assert.ok(seedKeys.every((k) => landingKeys.includes(k)));
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

  it('20. dry-008 → 사람이 도착 상품을 확인한 exact /a/ allowlist 링크', () => {
    const dry008 = PRODUCTS.find((p) => p.id === 'dry-008');
    assert.equal(dry008.productId, undefined);
    assert.equal(VERIFIED_SHORT['dry-008'], 'https://link.coupang.com/a/hccXPGgZbg');
    assert.equal(resolveVerifiedShortAffiliateHref(VERIFIED_SHORT['dry-008']), VERIFIED_SHORT['dry-008']);
    const resolved = resolveCoupangCta(dry008, REGISTRY);
    assert.equal(resolved.source, 'verified-short');
    assert.equal(resolved.href, dry008.coupangUrl);
  });

  it('seed 가 있어도 productId 가 pageKey 와 다르면 null', () => {
    const seed = { ...PRODUCTS.find((p) => p.id === 'dry-006'), productId: 1 };
    assert.equal(resolveCoupangTrackedHref(seed, REGISTRY), null);
  });

  it('landing 원문의 pageKey 가 키와 다르면 null', () => {
    const registry = { landingByProductId: { 8090724268: LANDING['8090724268'].replace('pageKey=8090724268', 'pageKey=8090724269') } };
    assert.equal(resolveCoupangTrackedHref(dbRow('8090724268'), registry), null);
  });

  it('landing 원문에 subid 가 없거나 다르거나 traceid 가 V0-153 이면 null (registry 도 만들지 않는다)', () => {
    const base = LANDING['8090724268'];
    for (const bad of [
      withParam(base, 'subid', null),
      withParam(base, 'subid', 'kkultem'),
      withParam(base, 'traceid', 'V0-153-e7d7dbd94ea4b733'),
    ]) {
      const registry = { landingByProductId: { 8090724268: bad } };
      assert.equal(resolveCoupangTrackedHref(dbRow('8090724268'), registry), null, bad);
    }
  });

  it('repo 60건 inventory: search-only 57 · exact seed 2 · verified short 1 · unresolved /a 0', () => {
    assert.equal(PRODUCTS.length, 60);
    const resolved = PRODUCTS.filter((p) => resolveCoupangTrackedHref(p, REGISTRY));
    const search = PRODUCTS.filter((p) => p.coupangUrl.startsWith('https://www.coupang.com/np/search'));
    const shortA = PRODUCTS.filter((p) => p.coupangUrl.startsWith('https://link.coupang.com/a/'));
    assert.equal(search.length, 57);
    assert.ok(search.every((p) => resolveCoupangTrackedHref(p, REGISTRY) === null));
    assert.deepEqual(resolved.map((p) => p.id).sort(), ['dry-006', 'dry-007', 'dry-008']);
    assert.deepEqual(
      shortA.filter((p) => !resolveCoupangTrackedHref(p, REGISTRY)).map((p) => p.id),
      [],
    );
  });

  it('13. provenance 없는 DB 형식 상품도 exact raw Search AFFSDP가 있으면 clickable CTA가 된다', () => {
    const raw = allPending().filter((p) => p.coupangUrl.startsWith('https://link.coupang.com/re/AFFSDP'));
    const withoutProvenance = raw.filter((p) => !Object.prototype.hasOwnProperty.call(LANDING, String(p.productId)));
    assert.ok(withoutProvenance.length > 0);
    assert.ok(withoutProvenance.every((p) => resolveCoupangCta(p, REGISTRY).source === 'search-raw'));
    assert.ok(withoutProvenance.every((p) => resolveCoupangTrackedHref(p, REGISTRY) === p.coupangUrl));
    const withProvenance = raw.filter((p) => Object.prototype.hasOwnProperty.call(LANDING, String(p.productId)));
    assert.equal(withProvenance.length, 16);
    assert.ok(withProvenance.every((p) => resolveCoupangCta(p, REGISTRY).source === 'landing'));
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
