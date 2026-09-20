#!/usr/bin/env node
/**
 * 쿠팡 파트너스 API 로 상품을 수집해 센치픽 데이터에 반영한다.
 *
 *   node scripts/sync-coupang.mjs            수집 + 파일 기록
 *   node scripts/sync-coupang.mjs --dry-run  파일을 쓰지 않고 결과만 출력
 *
 * 환경변수
 *   COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY  (필수)
 *   SYNC_LIMIT      키워드당 조회 수        기본 20
 *   SYNC_MAX_RANK   채택할 검색 순위 상한   기본 20
 *   SYNC_ROCKET_ONLY 로켓배송만            기본 true
 *   SYNC_DELAY_MS   호출 간 간격            기본 400
 *
 * API 가 치수와 리뷰 수를 주지 않으므로,
 *  - 상품명에서 치수를 뽑아낸 것만 products.json 에 넣고
 *  - 나머지는 pending.json 대기열로 보내 관리자가 치수만 채우게 한다.
 * 리뷰 수 대신 검색 순위(rank)를 인기도 기준으로 쓴다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_KEYWORDS } from './keywords.mjs';
import { searchProducts, sleep } from './coupangApi.mjs';
import {
  buildTags,
  cleanImageUrl,
  extractBrand,
  extractDimensions,
  extractSpec,
  todayIso,
} from './normalize.mjs';

const PRODUCTS_PATH = new URL('../src/data/products.json', import.meta.url);
const PENDING_PATH = new URL('../src/data/pending.json', import.meta.url);

const CATEGORY_PREFIX = {
  refrigerator: 'ref',
  washing_machine: 'wsh',
  dryer: 'dry',
  microwave: 'mic',
  desk: 'dsk',
  shelf: 'shf',
  bed: 'bed',
  hanger: 'hng',
  niche: 'nic',
  sofa: 'sfa',
  dishwasher: 'dsh',
  folding_table: 'ftb',
  shoe_rack: 'sho',
};

const dryRun = process.argv.includes('--dry-run');
const num = (name, fallback) => Number(process.env[name] ?? fallback);
const LIMIT = num('SYNC_LIMIT', 20);
const MAX_RANK = num('SYNC_MAX_RANK', 20);
const DELAY_MS = num('SYNC_DELAY_MS', 400);
const ROCKET_ONLY = (process.env.SYNC_ROCKET_ONLY ?? 'true') !== 'false';

const accessKey = process.env.COUPANG_ACCESS_KEY;
const secretKey = process.env.COUPANG_SECRET_KEY;
if (!accessKey || !secretKey) {
  console.error('COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없습니다.');
  process.exit(1);
}

const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));
const products = readJson(PRODUCTS_PATH);
let pending = [];
try {
  pending = readJson(PENDING_PATH);
} catch {
  pending = [];
}

// 이미 가지고 있는 상품은 다시 넣지 않는다
const knownProductIds = new Set(
  [...products, ...pending].map((p) => p.productId).filter(Boolean),
);
const knownNames = new Set([...products, ...pending].map((p) => p.name));

function nextId(category) {
  const prefix = CATEGORY_PREFIX[category];
  const used = [...products, ...pending]
    .filter((p) => typeof p.id === 'string' && p.id.startsWith(`${prefix}-`))
    .map((p) => Number(p.id.slice(prefix.length + 1)))
    .filter(Number.isFinite);
  return `${prefix}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`;
}

const stats = {
  조회: 0,
  로켓제외: 0,
  순위제외: 0,
  중복: 0,
  치수있음: 0,
  대기열: 0,
  가격갱신: 0,
  실패키워드: [],
};

// 기존 상품 가격 갱신용 색인
const byProductId = new Map(
  products.filter((p) => p.productId).map((p) => [p.productId, p]),
);

for (const { keyword, category } of ALL_KEYWORDS) {
  let items = [];
  try {
    items = await searchProducts(keyword, { limit: LIMIT, accessKey, secretKey });
  } catch (error) {
    stats.실패키워드.push(`${keyword} (${error.message})`);
    await sleep(DELAY_MS);
    continue;
  }
  stats.조회 += items.length;

  for (const item of items) {
    // 이미 등록된 상품이면 가격만 최신으로 맞춘다
    const existing = byProductId.get(item.productId);
    if (existing) {
      if (item.productPrice && existing.price !== item.productPrice) {
        existing.price = item.productPrice;
        existing.priceCheckedAt = todayIso();
        stats.가격갱신 += 1;
      }
      continue;
    }

    if (ROCKET_ONLY && !item.isRocket) {
      stats.로켓제외 += 1;
      continue;
    }
    // API 가 리뷰 수를 주지 않으므로 검색 순위를 인기도 기준으로 쓴다
    if (typeof item.rank === 'number' && item.rank > MAX_RANK) {
      stats.순위제외 += 1;
      continue;
    }
    if (knownProductIds.has(item.productId) || knownNames.has(item.productName)) {
      stats.중복 += 1;
      continue;
    }

    const name = String(item.productName ?? '').trim();
    if (!name) continue;

    const base = {
      id: nextId(category),
      productId: item.productId,
      name,
      category,
      brand: extractBrand(name),
      capacity_or_spec: extractSpec(name),
      imageUrl: cleanImageUrl(item.productImage),
      coupangUrl: item.productUrl,
      tags: buildTags(name, {
        isRocket: item.isRocket,
        isFreeShipping: item.isFreeShipping,
      }),
      price: item.productPrice ?? undefined,
      priceCheckedAt: item.productPrice ? todayIso() : undefined,
    };

    const dimensions = extractDimensions(name);
    if (dimensions) {
      // 상품명에 적힌 치수는 제조사 스펙 확인이 아니므로 verified 는 false 로 둔다
      products.push({ ...base, dimensions, verified: false });
      stats.치수있음 += 1;
    } else {
      pending.push({
        ...base,
        keyword,
        rank: item.rank ?? null,
        collectedAt: todayIso(),
      });
      stats.대기열 += 1;
    }

    knownProductIds.add(item.productId);
    knownNames.add(name);
  }

  await sleep(DELAY_MS);
}

// undefined 필드는 JSON 에 남기지 않는다
const compact = (list) =>
  list.map((p) => JSON.parse(JSON.stringify(p)));

if (!dryRun) {
  writeFileSync(PRODUCTS_PATH, JSON.stringify(compact(products), null, 2) + '\n');
  writeFileSync(PENDING_PATH, JSON.stringify(compact(pending), null, 2) + '\n');
}

console.log('── 쿠팡 수집 결과 ──');
console.log(`키워드 ${ALL_KEYWORDS.length}개 / 조회 ${stats.조회}건`);
console.log(`  로켓배송 아님 제외 ${stats.로켓제외}`);
console.log(`  ${MAX_RANK}위 밖 제외   ${stats.순위제외}`);
console.log(`  이미 있음 제외    ${stats.중복}`);
console.log(`  치수 있어 바로 등록 ${stats.치수있음}`);
console.log(`  치수 없어 대기열    ${stats.대기열}`);
console.log(`  가격 갱신          ${stats.가격갱신}`);
if (stats.실패키워드.length) {
  console.log(`  실패한 키워드 ${stats.실패키워드.length}개`);
  stats.실패키워드.slice(0, 5).forEach((k) => console.log(`    - ${k}`));
}
console.log(`전체 ${products.length}종 / 대기열 ${pending.length}건${dryRun ? ' (dry-run, 파일 미기록)' : ''}`);
