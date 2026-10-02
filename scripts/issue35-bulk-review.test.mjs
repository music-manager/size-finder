import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rows = JSON.parse(fs.readFileSync(new URL("../src/data/review-candidates.json", import.meta.url), "utf8"));
const ids = [7069500808,6778064266,7721773011,2568423,7544241100,8745138179,8957338677,8653204114,8745184047,9170159644,9702008480,9604034758,1552966630,9143269998,9736072987,9738777211,9645904189,9600062528,9284892054,9302423659,9453084478,9481770996,9742223039,9158850609,7471066803,8454410091,8969567173,9432445437,9584578321,7842523688,9576196805,9591431761,6947042222,8427769030,8579335963,8750671365,8410704563,7102076684,8338421081,28896030,8373550846,9160736353,8461629268];
const expectedCategoryDelta = {
  "folding_table": 17,
  "dishwasher": 3,
  "niche": 7,
  "shoe_rack": 8,
  "refrigerator": 8
};

test("issue #35 exact 43 review candidates are present once with safe provenance", () => {
  assert.equal(ids.length, 43);
  assert.equal(new Set(ids).size, 43);
  const byId = new Map(rows.map((row) => [Number(row.productId), row]));
  for (const id of ids) {
    const row = byId.get(Number(id));
    assert.ok(row, `missing issue #35 productId ${id}`);
    assert.equal(row.source, "coupang_search");
    assert.match(row.imageUrl, /^https:\/\//);
    assert.ok(row.itemId);
    assert.ok(row.vendorItemId);
    assert.ok(row.coupangUrl.includes(`pageKey=${id}`));
    assert.ok(row.coupangUrl.includes(`itemId=${row.itemId}`));
    assert.ok(row.coupangUrl.includes(`vendorItemId=${row.vendorItemId}`));
    assert.match(row.coupangUrl, /traceid=V0-153-/);
    assert.equal(row.priceCheckedAt, "2026-10-02");
    assert.match(row.note, /CTA 금지/);
    assert.equal("dimensions" in row, false);
    assert.equal("dimensionCandidate" in row, false);
  }
  const allIds = rows.filter((row) => row.productId != null).map((row) => Number(row.productId));
  assert.equal(new Set(allIds).size, allIds.length, "review-candidates productId must remain duplicate-free");
});

test("issue #35 category deltas stay exact", () => {
  const actual = {};
  for (const row of rows) {
    if (!ids.includes(Number(row.productId))) continue;
    actual[row.category] = (actual[row.category] ?? 0) + 1;
  }
  assert.deepEqual(actual, expectedCategoryDelta);
});
