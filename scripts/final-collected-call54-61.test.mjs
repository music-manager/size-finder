import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rows = JSON.parse(fs.readFileSync(new URL("../src/data/review-candidates.json", import.meta.url), "utf8"));
const batch = rows.filter((row) => Number(row.source_call_id) >= 54 && Number(row.source_call_id) <= 61);
const expectedCategoryDelta = {
  dryer: 14,
  bed: 14,
  washing_machine: 7,
  sofa: 7,
  hanger: 9,
};

test("call54~61 final collected batch is exactly 51 unique REVIEW rows", () => {
  assert.equal(batch.length, 51);
  const ids = batch.map((row) => Number(row.productId));
  assert.equal(new Set(ids).size, 51);

  const actual = {};
  for (const row of batch) {
    actual[row.category] = (actual[row.category] ?? 0) + 1;
    assert.equal(row.source, "coupang_search");
    assert.match(row.imageUrl, /^https:\/\//);
    assert.ok(row.itemId);
    assert.ok(row.vendorItemId);
    assert.ok(row.coupangUrl.includes(`pageKey=${row.productId}`));
    assert.ok(row.coupangUrl.includes(`itemId=${row.itemId}`));
    assert.ok(row.coupangUrl.includes(`vendorItemId=${row.vendorItemId}`));
    assert.match(row.coupangUrl, /traceid=V0-153-/);
    assert.match(row.note, /CTA 금지/);
    assert.equal("dimensions" in row, false);
    assert.equal("dimensionCandidate" in row, false);
  }
  assert.deepEqual(actual, expectedCategoryDelta);
});

test("call61 is the final CmPick API batch and contributes 9 hanger REVIEW rows", () => {
  const last = batch.filter((row) => Number(row.source_call_id) === 61);
  assert.equal(last.length, 9);
  assert.ok(last.every((row) => row.category === "hanger"));
  assert.ok(last.every((row) => row.keyword === "슬림 행거"));
});

test("call44 duplicated productId uses the lowest-rank canonical identity", () => {
  const row = rows.find((row) => Number(row.productId) === 9746324256);
  assert.ok(row);
  assert.equal(row.itemId, "29177882873");
  assert.equal(row.vendorItemId, "96099149625");
  assert.ok(row.coupangUrl.includes("itemId=29177882873"));
  assert.ok(row.coupangUrl.includes("vendorItemId=96099149625"));
});
