/**
 * 공개 카탈로그 1차 완료 게이트.
 *
 *   npm run catalog:gate
 *
 * 저장소에 있는 실데이터(verified seed + pending 실수집 + review-candidates)만으로
 * 서로 다른 쿠팡 productId 수를 세고, PUBLIC_CATALOG_TARGET(1000) 미만이면 실패한다.
 * 운영 DB 의 verified 는 여기서 조회하지 않는다(네트워크 0회).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PUBLIC_CATALOG_TARGET, buildPublicCatalog } from '../src/lib/publicCatalog.ts';

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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = loadRepoCatalog();
  const line = `공개 카탈로그 unique productId ${catalog.uniqueProductIds} / 목표 ${PUBLIC_CATALOG_TARGET} (verified ${catalog.verified.length} · review ${catalog.review.length})`;
  if (catalog.uniqueProductIds < PUBLIC_CATALOG_TARGET) {
    console.error(`✗ ${line}`);
    process.exit(1);
  }
  console.log(`✓ ${line}`);
}
