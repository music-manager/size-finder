import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCachedProducts,
  extractDimensionCandidate,
  extractModelCodes,
  findAutomaticMatch,
  normalizeCoupangProduct,
} from './coordinator/productPipeline.mjs';
import { validateData } from './validate-data.mjs';

const seed = {
  id: 'ref-test-001',
  name: '삼성전자 소형 냉장고 RT16 152L',
  category: 'refrigerator',
  brand: '삼성전자',
  dimensions: { width: 55, depth: 57.8, height: 128.5 },
  coupangUrl: 'https://www.coupang.com/np/search?q=seed',
  imageUrl: '',
  tags: ['1등급'],
  verified: false,
};

function api(overrides = {}) {
  return {
    productId: 123456789,
    productName: '삼성전자 RT16 소형 냉장고 152L',
    productPrice: 299000,
    productImage: 'https://example.test/product.jpg',
    productUrl: 'https://link.coupang.com/a/test',
    rank: 1,
    isRocket: true,
    isFreeShipping: true,
    ...overrides,
  };
}

describe('Coupang cache normalization', () => {
  it('API image/price/deep-link metadata is normalized', () => {
    const item = normalizeCoupangProduct(api(), {
      category: 'refrigerator',
      keyword: '원룸 냉장고',
    });
    assert.equal(item.productId, '123456789');
    assert.equal(item.price, 299000);
    assert.equal(item.imageUrl, 'https://example.test/product.jpg');
    assert.equal(item.coupangUrl, 'https://link.coupang.com/a/test');
    assert.equal(item.sourceKeyword, '원룸 냉장고');
    assert.ok(item.tags.includes('로켓배송'));
  });

  it('missing productId/name/url is rejected', () => {
    assert.equal(normalizeCoupangProduct(api({ productId: null }), { category: 'refrigerator' }), null);
    assert.equal(normalizeCoupangProduct(api({ productName: '' }), { category: 'refrigerator' }), null);
    assert.equal(normalizeCoupangProduct(api({ productUrl: '' }), { category: 'refrigerator' }), null);
  });
});

describe('dimension candidates are never promoted to official dimensions', () => {
  it('parses title dimension only as unverified candidate', () => {
    const d = extractDimensionCandidate('수납장 600x450x720mm');
    assert.deepEqual(d, {
      width: 60,
      depth: 45,
      height: 72,
      source: 'title_parse',
      verified: false,
    });
  });

  it('implausible title dimensions are ignored', () => {
    assert.equal(extractDimensionCandidate('선반 1x2x3cm'), null);
  });
});

describe('automatic identity matching is strict', () => {
  it('extracts alphanumeric model codes, not capacity-only tokens', () => {
    assert.deepEqual(extractModelCodes('삼성 RT16 152L 냉장고'), ['RT16']);
  });

  it('same brand + same clear model code can match', () => {
    const candidate = normalizeCoupangProduct(api(), { category: 'refrigerator' });
    const match = findAutomaticMatch([seed], candidate);
    assert.equal(match?.product.id, seed.id);
    assert.equal(match?.reason, 'brand_model');
  });

  it('similar name without model code never auto-matches', () => {
    const candidate = normalizeCoupangProduct(
      api({ productName: '삼성전자 소형 냉장고 152L 원룸형' }),
      { category: 'refrigerator' },
    );
    assert.equal(findAutomaticMatch([seed], candidate), null);
  });

  it('same model code but different brand never auto-matches', () => {
    const candidate = normalizeCoupangProduct(
      api({ productName: '하이얼 RT16 소형 냉장고 152L' }),
      { category: 'refrigerator' },
    );
    assert.equal(findAutomaticMatch([seed], candidate), null);
  });

  it('existing productId has priority over name matching', () => {
    const withId = { ...seed, productId: '123456789' };
    const candidate = normalizeCoupangProduct(
      api({ productName: '전혀 다른 이름' }),
      { category: 'refrigerator' },
    );
    assert.equal(findAutomaticMatch([withId], candidate)?.reason, 'productId');
  });

  it('ambiguous model matches are sent to review instead of guessing', () => {
    const candidate = normalizeCoupangProduct(api(), { category: 'refrigerator' });
    const duplicate = { ...seed, id: 'ref-test-002' };
    assert.equal(findAutomaticMatch([seed, duplicate], candidate), null);
  });
});

describe('batch application', () => {
  it('matched product gets API metadata but keeps seed dimensions and verified flag', () => {
    const before = structuredClone(seed);
    const { products, pending, report } = applyCachedProducts({
      products: [seed],
      pending: [],
      rawProducts: [api()],
      category: 'refrigerator',
      keyword: '원룸 냉장고',
      now: '2026-09-23T00:00:00.000Z',
    });

    assert.equal(report.matched, 1);
    assert.equal(pending.length, 0);
    assert.deepEqual(products[0].dimensions, before.dimensions);
    assert.equal(products[0].verified, false);
    assert.equal(products[0].imageUrl, 'https://example.test/product.jpg');
    assert.equal(products[0].price, 299000);
    assert.equal(products[0].coupangUrl, 'https://link.coupang.com/a/test');
    assert.equal(products[0].apiMetadata.matchReason, 'brand_model');
  });

  it('unmatched product goes to pending, even when title contains dimensions', () => {
    const raw = api({
      productId: 888,
      productName: '미디어 ABC123 미니 냉장고 500x500x800mm',
    });
    const { products, pending, report } = applyCachedProducts({
      products: [seed],
      pending: [],
      rawProducts: [raw],
      category: 'refrigerator',
      keyword: '미니 냉장고',
    });

    assert.equal(products.length, 1);
    assert.equal(report.pending, 1);
    assert.equal(pending[0].productId, '888');
    assert.equal(pending[0].dimensions, undefined);
    assert.deepEqual(pending[0].dimensionCandidate, {
      width: 50,
      depth: 50,
      height: 80,
      source: 'title_parse',
      verified: false,
    });
  });

  it('duplicate productId is not appended twice', () => {
    const first = api({ productId: 999, productName: '미디어 ABC999 냉장고' });
    const second = api({ productId: 999, productName: '미디어 ABC999 냉장고 새 제목' });
    const result = applyCachedProducts({
      products: [seed],
      pending: [],
      rawProducts: [first, second],
      category: 'refrigerator',
      keyword: '냉장고',
    });
    assert.equal(result.pending.length, 1);
    assert.equal(result.report.skippedDuplicate, 1);
  });

  it('result remains compatible with existing data validator', () => {
    const result = applyCachedProducts({
      products: [seed],
      pending: [],
      rawProducts: [api({ productId: 888, productName: '미디어 ABC123 미니 냉장고' })],
      category: 'refrigerator',
      keyword: '미니 냉장고',
    });
    const errors = validateData({
      ...result,
      state: { keywordCursor: 0, lastRunAt: null, lastResult: null },
    });
    assert.deepEqual(errors, [], errors.join('\n'));
  });
});
