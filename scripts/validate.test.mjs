/**
 * 상품 데이터 validator 테스트.
 *
 * 쿠팡 API 를 부르지 않는다. 파일을 읽고 순수 함수를 돌릴 뿐이다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateData } from './validate-data.mjs';

describe('validate-data', () => {
  const dataUrl = (name) => new URL(`../src/data/${name}`, import.meta.url);
  const realProducts = JSON.parse(readFileSync(dataUrl('products.json'), 'utf8'));
  const realPending = JSON.parse(readFileSync(dataUrl('pending.json'), 'utf8'));
  const realState = JSON.parse(readFileSync(dataUrl('sync-state.json'), 'utf8'));

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const okState = { keywordCursor: 0, lastRunAt: null, lastResult: null };

  /** 최소 형태를 갖춘 유효한 항목 */
  const item = (over = {}) => ({
    id: 'ref-900',
    name: '테스트 냉장고',
    category: 'refrigerator',
    coupangUrl: 'https://link.coupang.com/a/test',
    tags: ['초소형'],
    dimensions: { width: 45, depth: 50, height: 85 },
    ...over,
  });

  const run = (over = {}) =>
    validateData({ products: [], pending: [], state: okState, ...over });

  it('1. 현재 실제 데이터 3종이 그대로 통과한다', () => {
    const errors = validateData({
      products: realProducts,
      pending: realPending,
      state: realState,
    });
    assert.deepEqual(errors, [], errors.join('\n'));
  });

  it('2. id 중복이면 실패한다', () => {
    const errors = run({ products: [item({ id: 'dup-1' }), item({ id: 'dup-1' })] });
    assert.ok(errors.some((e) => /id 중복/.test(e)), errors.join('\n'));
  });

  it('3. productId 중복이면 실패한다', () => {
    const errors = run({
      products: [item({ id: 'a-1', productId: 111 })],
      pending: [item({ id: 'a-2', productId: 111, dimensions: undefined })],
    });
    assert.ok(errors.some((e) => /productId 중복/.test(e)), errors.join('\n'));
  });

  it('4. dimensions.width 가 -1 이면 실패한다', () => {
    const errors = run({ products: [item({ dimensions: { width: -1, depth: 50, height: 85 } })] });
    assert.ok(errors.some((e) => /dimensions\.width/.test(e)), errors.join('\n'));
  });

  it('5. dimensions.depth 가 NaN 이나 문자열이면 실패한다', () => {
    const nan = run({ products: [item({ dimensions: { width: 45, depth: NaN, height: 85 } })] });
    assert.ok(nan.some((e) => /dimensions\.depth/.test(e)), nan.join('\n'));

    const str = run({ products: [item({ dimensions: { width: 45, depth: '50', height: 85 } })] });
    assert.ok(str.some((e) => /dimensions\.depth/.test(e)), str.join('\n'));
  });

  it('6. keywordCursor 가 68 이면 실패한다', () => {
    const errors = run({ state: { ...okState, keywordCursor: 68 } });
    assert.ok(errors.some((e) => /keywordCursor/.test(e)), errors.join('\n'));
  });

  it('7. keywordCursor 가 -1 이면 실패한다', () => {
    const errors = run({ state: { ...okState, keywordCursor: -1 } });
    assert.ok(errors.some((e) => /keywordCursor/.test(e)), errors.join('\n'));
  });

  it('8. lastResult 가 "unknown" 이면 실패한다', () => {
    const errors = run({ state: { ...okState, lastResult: 'unknown' } });
    assert.ok(errors.some((e) => /lastResult/.test(e)), errors.join('\n'));
  });

  it('9. productId 가 없어도 통과한다 (기존 60종)', () => {
    const noProductId = clone(realProducts).map((p) => {
      delete p.productId;
      return p;
    });
    assert.deepEqual(validateData({ products: noProductId, pending: [], state: okState }), []);
  });

  it('10. price 가 없어도 통과한다 (기존 60종)', () => {
    const noPrice = clone(realProducts).map((p) => {
      delete p.price;
      delete p.priceCheckedAt;
      return p;
    });
    assert.deepEqual(validateData({ products: noPrice, pending: [], state: okState }), []);
  });

  it('11. imageUrl 이 빈 문자열이어도 통과한다', () => {
    assert.deepEqual(run({ products: [item({ imageUrl: '' })] }), []);
  });

  it('허용되는 lastResult 4가지는 모두 통과한다', () => {
    for (const value of [null, 'ok', 'rate_limited', 'aborted']) {
      assert.deepEqual(run({ state: { ...okState, lastResult: value } }), [], `lastResult=${value}`);
    }
  });

  it('lastRunAt 은 null 이나 ISO 문자열만 허용한다', () => {
    assert.deepEqual(run({ state: { ...okState, lastRunAt: new Date().toISOString() } }), []);
    const bad = run({ state: { ...okState, lastRunAt: '어제' } });
    assert.ok(bad.some((e) => /lastRunAt/.test(e)), bad.join('\n'));
  });

  it('공통 필수값이 비면 실패한다', () => {
    for (const field of ['id', 'name', 'category', 'coupangUrl']) {
      const errors = run({ products: [item({ [field]: '' })] });
      assert.ok(errors.some((e) => e.includes(`.${field}:`)), `${field} 검사 누락`);
    }
    const noTags = run({ products: [item({ tags: undefined })] });
    assert.ok(noTags.some((e) => /\.tags:/.test(e)));
  });

  it('products 는 dimensions 가 없으면 실패하고 pending 은 통과한다', () => {
    const noDim = run({ products: [item({ dimensions: undefined })] });
    assert.ok(noDim.some((e) => /dimensions/.test(e)));

    const pendingNoDim = run({ pending: [item({ dimensions: undefined })] });
    assert.deepEqual(pendingNoDim, [], '대기열은 치수를 아직 모르는 상태다');
  });

  it('price 가 있으면 0보다 큰 숫자여야 한다', () => {
    assert.ok(run({ products: [item({ price: 0 })] }).some((e) => /\.price:/.test(e)));
    assert.ok(run({ products: [item({ price: '1000' })] }).some((e) => /\.price:/.test(e)));
    assert.deepEqual(run({ products: [item({ price: 1000 })] }), []);
  });

  it('배열이 아니면 실패한다', () => {
    assert.ok(run({ products: {} }).some((e) => /products\.json: 배열/.test(e)));
    assert.ok(run({ pending: null }).some((e) => /pending\.json: 배열/.test(e)));
  });
});
