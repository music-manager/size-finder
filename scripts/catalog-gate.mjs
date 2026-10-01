/**
 * 공개 카탈로그 1차 완료 게이트.
 *
 *   npm run catalog:gate
 *
 * 저장소에 있는 실데이터(verified seed + pending 실수집 + review-candidates)만으로
 * 서로 다른 쿠팡 productId 수를 세고, 아래 둘 중 하나라도 못 미치면 실패한다.
 *   - 전체 unique productId >= PUBLIC_CATALOG_TARGET(1000)
 *   - 모든 공개 카테고리 탭 unique productId >= MIN_PUBLIC_PER_CATEGORY(10)
 * 운영 DB 의 verified 는 여기서 조회하지 않는다(네트워크 0회).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  MIN_PUBLIC_PER_CATEGORY,
  PUBLIC_CATALOG_TARGET,
  buildPublicCatalog,
  categoryShortfalls,
  uniqueProductIdsFor,
} from '../src/lib/publicCatalog.ts';
import { CATEGORIES, CATEGORY_MATCH } from '../src/lib/categories.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export function loadRepoCatalog() {
  const products = readJson('src/data/products.json');
  const pending = readdirSync(join(ROOT, 'src/data'))
    .filter((f) => /^pending.*\.json$/.test(f))
    .sort()
    .flatMap((f) => readJson(`src/data/${f}`))
    .concat(readJson('src/data/review-candidates.json'));
  const seedById = readJson('src/data/coupang-cta-provenance.json').seedById ?? {};
  const seedPageKeys = Object.fromEntries(Object.entries(seedById).map(([id, i]) => [id, i.pageKey]));
  return buildPublicCatalog(products, pending, seedPageKeys);
}

export function loadSeedPageKeys() {
  const seedById = readJson('src/data/coupang-cta-provenance.json').seedById ?? {};
  return Object.fromEntries(Object.entries(seedById).map(([id, i]) => [id, i.pageKey]));
}

/** 홈 카테고리 탭(전체 제외)과 각 탭이 보여주는 category 목록 */
export const PUBLIC_TABS = CATEGORIES.filter((c) => c.id !== 'all').map((c) => ({
  id: c.id,
  label: c.label,
  allowed: CATEGORY_MATCH[c.id],
}));

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = loadRepoCatalog();
  const seedPageKeys = loadSeedPageKeys();
  const line = `공개 카탈로그 unique productId ${catalog.uniqueProductIds} / 목표 ${PUBLIC_CATALOG_TARGET} (verified ${catalog.verified.length} · review ${catalog.review.length})`;
  const perTab = PUBLIC_TABS.map((t) => `${t.id}=${uniqueProductIdsFor(catalog, t.allowed, seedPageKeys)}`).join(' ');
  const shortfalls = categoryShortfalls(catalog, PUBLIC_TABS, seedPageKeys);
  const totalOk = catalog.uniqueProductIds >= PUBLIC_CATALOG_TARGET;
  console.log(`카테고리별 unique productId: ${perTab}`);
  console.log(
    shortfalls.length
      ? `${MIN_PUBLIC_PER_CATEGORY}개 미만 카테고리 ${shortfalls.length}개: ${shortfalls.map((r) => `${r.id}(${r.count})`).join(', ')}`
      : `모든 카테고리 ${MIN_PUBLIC_PER_CATEGORY}개 이상`,
  );
  if (!totalOk || shortfalls.length) {
    console.error(`✗ ${line}`);
    process.exit(1);
  }
  console.log(`✓ ${line}`);
}
