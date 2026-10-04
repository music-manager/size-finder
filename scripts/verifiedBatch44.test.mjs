/**
 * Issue #44 수동 치수검증 배치 — 신규 VERIFIED 51건 노출.
 *
 * - 치수는 manifest 의 검증값만, 이름 · 이미지 · 가격 · 저장 URL 은 같은 productId 의 REVIEW 기록 그대로
 * - HOLD · REVIEW · 이미 운영 반영된 #1 은 들어오지 않는다
 * - CTA 는 새로 만들지 않는다: 지금 공개 REVIEW 카드와 같은 href, 없던 상품은 null(구매 링크 검증 중)
 * - 운영 DB · seed 에 같은 productId verified 가 있으면 그쪽이 남는다
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  appendVerifiedBatch,
  buildVerifiedBatchProducts,
  toVerifiedBatchProduct,
} from '../src/lib/verifiedBatch.ts';
import {
  buildPublicCatalog,
  categoryIdentityRejection,
  hasPublicImage,
  toReviewCandidate,
  uniqueProductIdsFor,
  verifiedProductKey,
} from '../src/lib/publicCatalog.ts';
import { resolveCoupangTrackedHref } from '../src/lib/coupangCta.ts';
import { PUBLIC_TABS, loadRepoCatalog } from './catalog-gate.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const readJson = (p) => JSON.parse(read(p));

const ROWS = readJson('src/data/verified-batch-44.json');
const RECORDS = readJson('src/data/review-candidates.json');
const REGISTRY = readJson('src/data/coupang-cta-provenance.json');
const SEEDS = readJson('src/data/products.json').filter((p) => p.verified);
const SEED_PAGE_KEYS = Object.fromEntries(Object.entries(REGISTRY.seedById).map(([id, i]) => [id, i.pageKey]));
const BATCH = buildVerifiedBatchProducts(ROWS, RECORDS);
const recordOf = (pid) => RECORDS.find((r) => r.productId === pid);
const keyOf = (p) => verifiedProductKey(p, SEED_PAGE_KEYS);

// Issue #44 감사로 READY 확정된 28건 (#3~#35 중 HOLD 6 · 이미 반영 #1 제외, #11 정정 포함)
const ISSUE_READY_28 = [
  8301888380, 7912950280, 7494775376, 8744624788, 8918154578, 8657850118, 8670873654, 8982193574, 8844314186,
  8653204114, 8745184047, 4882898698, 7939925865, 8505623426, 8987450079, 9626332974, 8410704563, 7102076684,
  8338421081, 8373550846, 9160736353, 8461629268, 5465944755, 9036906249, 9249669679, 6048016397, 7478759947,
  7546820404,
];
// 사용자 수동검증 #36~#58 (Issue #44 댓글 5977113743)
const SESSION_23 = [
  9596167043, 6538307136, 7470420740, 8472546188, 9707561407, 9665035076, 9415097345, 8579335930, 6595043415,
  8452579582, 9040838700, 9669290538, 8273486865, 7539323611, 8253845369, 7646511942, 7169481764, 6252334388,
  5659094136, 2354065065, 9542185086, 9531568040, 8728923322,
];
const ALREADY_IN_PRODUCTION = [7216908117];
const HOLD = [8750671365, 9522527501, 7660428989, 28896030, 9748766128, 6784715012, 9642239361];
const REVIEW = [
  9742223039, 8952948948, 9739138804, 9746324256, 8736385652, 9675387196, 8761359733, 8858757907,
  8960361172, 9693159632, 205424106, 1676362802,
];

describe('Issue #44 배치 manifest', () => {
  it('정확히 51행 = Issue READY 28 + 이번 수동검증 23, productId 중복 0', () => {
    const ids = ROWS.map((r) => r.productId);
    assert.equal(ids.length, 51);
    assert.equal(new Set(ids).size, 51);
    assert.deepEqual([...ids].sort(), [...ISSUE_READY_28, ...SESSION_23].sort());
  });

  it('HOLD 7 · REVIEW 12 · 이미 운영 반영 #1 은 들어오지 않는다', () => {
    const ids = new Set(ROWS.map((r) => r.productId));
    for (const pid of [...HOLD, ...REVIEW, ...ALREADY_IN_PRODUCTION]) assert.equal(ids.has(pid), false, String(pid));
    assert.equal(new Set([...HOLD, ...REVIEW]).size, HOLD.length + REVIEW.length, 'HOLD/REVIEW 교차중복 0');
  });

  it('모든 행은 W/D/H > 0, provenance(source · Issue 댓글), 원문 치수 기록을 가진다', () => {
    for (const row of ROWS) {
      for (const axis of ['width', 'depth', 'height']) assert.ok(row.dimensions[axis] > 0, `${row.productId} ${axis}`);
      assert.equal(row.provenance.source, 'manual_verified_user_screenshot', String(row.productId));
      assert.equal(row.provenance.issue, 44);
      assert.ok(Number.isInteger(row.provenance.entry) && row.provenance.entry >= 3 && row.provenance.entry <= 58);
      assert.ok(row.provenance.commentId, String(row.productId));
      assert.ok(typeof row.sourceDimensions === 'string' && row.sourceDimensions.length > 0, String(row.productId));
    }
  });

  it('확정 정책값: #11 본체 55.5×50×45 · 7494775376 물탱크 포함 45.5×42×52 · 8579335930 높이는 판매자 답변 305mm', () => {
    const dims = (pid) => Object.values(ROWS.find((r) => r.productId === pid).dimensions);
    assert.deepEqual(dims(8982193574), [55.5, 50, 45]);
    assert.equal(ROWS.find((r) => r.productId === 8982193574).provenance.correctionCommentId, 5968190130);
    assert.match(ROWS.find((r) => r.productId === 8982193574).installReference, /55\.5×51×47/);
    assert.deepEqual(dims(7494775376), [45.5, 42, 52]);
    assert.deepEqual(dims(8579335930), [90, 60, 30.5]);
    assert.equal(ROWS.find((r) => r.productId === 8579335930).provenance.heightSource, 'seller_QA_height_305mm');
    assert.deepEqual(dims(9531568040), [80, 80, 74]);
    assert.deepEqual(dims(7470420740), dims(8472546188), '치수는 같지만 모델이 달라 각각 유지');
  });

  it('itemId · vendorItemId · category 는 저장 기록과 같고 바꾸지 않는다', () => {
    for (const row of ROWS) {
      const rec = recordOf(row.productId);
      assert.ok(rec, String(row.productId));
      assert.equal(row.category, rec.category, String(row.productId));
      assert.equal(row.itemId, rec.itemId, String(row.productId));
      assert.equal(row.vendorItemId, rec.vendorItemId, String(row.productId));
      const q = new URL(rec.coupangUrl).searchParams;
      assert.deepEqual([q.get('pageKey'), q.get('itemId'), q.get('vendorItemId')], [String(row.productId), row.itemId, row.vendorItemId]);
    }
  });
});

describe('배치 → 공개 VERIFIED Product', () => {
  it('51건 모두 Product 로 만들어지고 이름 · 이미지 · 가격은 저장 기록 그대로, https 이미지', () => {
    assert.equal(BATCH.length, 51);
    for (const product of BATCH) {
      const rec = recordOf(product.productId);
      assert.equal(product.id, `cp-${product.productId}`);
      assert.equal(product.verified, true);
      assert.equal(product.name, rec.name.trim());
      assert.equal(product.imageUrl, rec.imageUrl);
      assert.ok(hasPublicImage(product.imageUrl), String(product.productId));
      assert.equal(product.price, rec.price);
    }
  });

  it('근거가 맞지 않으면 만들지 않는다 (fail-closed)', () => {
    const row = ROWS[0];
    const rec = recordOf(row.productId);
    assert.ok(toVerifiedBatchProduct(row, rec));
    assert.equal(toVerifiedBatchProduct(row, undefined), null);
    assert.equal(toVerifiedBatchProduct(row, { ...rec, vendorItemId: '1' }), null, 'option identity 불일치');
    assert.equal(toVerifiedBatchProduct(row, { ...rec, category: 'sofa' }), null);
    assert.equal(toVerifiedBatchProduct({ ...row, dimensions: { ...row.dimensions, depth: 0 } }, rec), null);
  });

  it('CTA 신규 생성 0 — 지금 공개 REVIEW 카드의 href 와 정확히 같다 (없던 상품은 null)', () => {
    let keep = 0;
    let none = 0;
    for (const row of ROWS) {
      const rec = recordOf(row.productId);
      const review = toReviewCandidate(rec);
      const before = review && review.source === 'coupang_search'
        ? resolveCoupangTrackedHref({ id: `cp-${row.productId}`, coupangUrl: review.coupangUrl, productId: review.productId }, REGISTRY)
        : null;
      const product = BATCH.find((p) => p.productId === row.productId);
      const after = resolveCoupangTrackedHref(product, REGISTRY);
      assert.equal(after, before, String(row.productId));
      assert.equal(row.cta, before ? 'keep_existing' : 'none', String(row.productId));
      if (row.cta === 'none') assert.equal(product.coupangUrl, '', 'V0-153 원문을 새 CTA 로 쓰지 않는다');
      if (after) {
        assert.equal(after, rec.coupangUrl, '저장 URL 을 바꾸지 않는다');
        keep++;
      } else none++;
    }
    assert.deepEqual({ keep, none }, { keep: 49, none: 2 });
    assert.deepEqual(ROWS.filter((r) => r.cta === 'none').map((r) => r.productId).sort(), [2354065065, 5659094136]);
  });

  it('CTA provenance · 렌더링 속성은 그대로 (seed 2 · landing 16 · rel/target · Referrer-Policy)', () => {
    assert.deepEqual(Object.keys(REGISTRY.seedById).sort(), ['dry-006', 'dry-007']);
    assert.equal(Object.keys(REGISTRY.landingByProductId).length, 16);
    for (const file of ['src/components/ProductCard.tsx', 'src/components/ProductDetail.tsx', 'src/components/ReviewCard.tsx']) {
      const src = read(file);
      assert.match(src, /target="_blank"/);
      assert.match(src, /rel="noopener noreferrer sponsored"/);
      assert.match(src, /구매 링크 검증 중/);
    }
    assert.match(read('netlify.toml'), /Referrer-Policy = "strict-origin-when-cross-origin"/);
  });
});

describe('공개 카탈로그 반영', () => {
  const records = [...RECORDS];
  const withBatch = (verified) => buildPublicCatalog(appendVerifiedBatch(verified, BATCH, keyOf), records, SEED_PAGE_KEYS);

  it('배치 51건 중 오픈 품질 미완성 2건을 제외한 49건이 verified(fit 대상)로 들어가고 공개 중복 0', () => {
    const before = buildPublicCatalog(SEEDS, records, SEED_PAGE_KEYS);
    const after = withBatch(SEEDS);
    assert.equal(after.verified.length, SEEDS.length + 49);
    const reviewIds = new Set(after.review.map((c) => c.productId));
    for (const pid of [...ISSUE_READY_28, ...SESSION_23]) assert.equal(reviewIds.has(pid), false, String(pid));
    const keys = after.verified.map(keyOf).filter((k) => k !== null);
    assert.equal(new Set(keys).size, keys.length, 'verified productId 중복 0');
    for (const k of keys) assert.equal(reviewIds.has(k), false, 'verified/REVIEW 교차 0');
    // CTA provenance 미완성 접이식테이블 2건은 verified 데이터는 보존하되 공개에서는 계속 숨긴다
    assert.equal(after.uniqueProductIds, before.uniqueProductIds);
    for (const pid of [5659094136, 2354065065]) {
      assert.notEqual(categoryIdentityRejection(pid, recordOf(pid).name, 'folding_table'), null);
      assert.equal(after.verified.some((p) => p.productId === pid), false, String(pid));
    }
  });

  it('HOLD · REVIEW 는 계속 REVIEW(또는 비공개)이고 fit 대상이 아니다', () => {
    const after = withBatch(SEEDS);
    const verifiedIds = new Set(after.verified.map(keyOf));
    for (const pid of [...HOLD, ...REVIEW]) assert.equal(verifiedIds.has(pid), false, String(pid));
  });

  it('운영 DB 에 같은 productId verified 가 이미 있으면 그 행이 남고 배치는 건너뛴다 (id 가 달라도)', () => {
    const dbRow = { ...BATCH[0], id: 'db-row-1', name: 'DB 기존 VERIFIED', dimensions: { width: 1, depth: 1, height: 1 } };
    const merged = appendVerifiedBatch([...SEEDS, dbRow], BATCH, keyOf);
    const same = merged.filter((p) => p.productId === BATCH[0].productId);
    assert.deepEqual(same.map((p) => p.id), ['db-row-1']);
    assert.equal(merged.length, SEEDS.length + 1 + 50);
    const unverifiedDb = { ...dbRow, verified: false };
    const merged2 = appendVerifiedBatch([...SEEDS, unverifiedDb], BATCH, keyOf);
    assert.ok(merged2.some((p) => p.id === `cp-${BATCH[0].productId}`), 'DB 미검증 행은 배치를 막지 않는다');
  });

  it('카테고리별 공개 고유상품은 줄지 않는다', () => {
    const before = buildPublicCatalog(SEEDS, records, SEED_PAGE_KEYS);
    const after = withBatch(SEEDS);
    for (const tab of PUBLIC_TABS) {
      assert.ok(uniqueProductIdsFor(after, tab.allowed, SEED_PAGE_KEYS) >= uniqueProductIdsFor(before, tab.allowed, SEED_PAGE_KEYS), tab.id);
    }
    assert.ok(loadRepoCatalog().uniqueProductIds > 0);
  });

  it('앱 배선: 공개 카탈로그 · 라이브 카탈로그 모두 withVerifiedBatch 를 거친다', () => {
    assert.match(read('src/lib/publicCatalogData.ts'), /buildPublicCatalog\(withVerifiedBatch\(verifiedProducts\), records, SEED_PAGE_KEYS\)/);
    assert.match(read('src/lib/liveCatalog.ts'), /withVerifiedBatch\(verifiedOnly\(await getAllLiveProducts\(\)\)\)/);
  });
});
