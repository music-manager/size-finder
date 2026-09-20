#!/usr/bin/env node
/**
 * 쿠팡 파트너스 API 로 상품을 수집해 센치픽 데이터에 반영한다.
 *
 *   node scripts/sync-coupang.mjs            수집 + 파일 기록
 *   node scripts/sync-coupang.mjs --dry-run  파일을 쓰지 않고 결과만 출력
 *
 * 환경변수
 *   COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY  (필수)
 *   SYNC_LIMIT      키워드당 조회 수        기본 10 (쿠팡 검색 API 최대 10)
 *   SYNC_MAX_RANK   채택할 검색 순위 상한   기본 10 (API 파라미터 아님, 상한 없음)
 *   SYNC_ROCKET_ONLY 로켓배송만            기본 true
 *   SYNC_DELAY_MS   호출 간 간격            기본 1300
 *   SYNC_BATCH_SIZE 한 번에 처리할 키워드 수 기본 8 (시간당 10회 한도 대비 여유분 2)
 *   SYNC_DATA_DIR   데이터 디렉터리          기본 ../src/data (테스트용 덮어쓰기)
 *
 * 쿠팡 상품검색은 시간당 10회만 허용되므로 키워드 68개를 한 번에 돌리지 않는다.
 * 한 번 실행에 SYNC_BATCH_SIZE 개만 처리하고, 다음 키워드 위치를
 * sync-state.json 에 남겨 다음 실행이 이어받는다. 끝까지 가면 0 으로 돌아온다.
 *
 * API 가 치수와 리뷰 수를 주지 않으므로,
 *  - 상품명에서 치수를 뽑아낸 것만 products.json 에 넣고
 *  - 나머지는 pending.json 대기열로 보내 관리자가 치수만 채우게 한다.
 * 리뷰 수 대신 검색 순위(rank)를 인기도 기준으로 쓴다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_KEYWORDS } from './keywords.mjs';
import { searchProducts, sleep } from './coupangApi.mjs';
import {
  DEFAULT_BATCH_SIZE,
  advanceCursor,
  normalizeCursor,
  readState,
  takeBatch,
  writeState,
} from './syncState.mjs';
import {
  buildTags,
  cleanImageUrl,
  extractBrand,
  extractDimensions,
  extractSpec,
  todayIso,
} from './normalize.mjs';

// 테스트가 임시 디렉터리를 물릴 수 있도록 데이터 위치를 바꿀 수 있게 둔다
const DATA_DIR = process.env.SYNC_DATA_DIR
  ? pathToFileURL(resolve(process.env.SYNC_DATA_DIR) + '/')
  : new URL('../src/data/', import.meta.url);
const PRODUCTS_PATH = new URL('products.json', DATA_DIR);
const PENDING_PATH = new URL('pending.json', DATA_DIR);
const STATE_PATH = new URL('sync-state.json', DATA_DIR);

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
const LIMIT = num('SYNC_LIMIT', 10);
const MAX_RANK = num('SYNC_MAX_RANK', 10);
const DELAY_MS = num('SYNC_DELAY_MS', 1300);
const BATCH_SIZE = num('SYNC_BATCH_SIZE', DEFAULT_BATCH_SIZE);
const ROCKET_ONLY = (process.env.SYNC_ROCKET_ONLY ?? 'true') !== 'false';

if (!Number.isInteger(LIMIT) || LIMIT < 1 || LIMIT > 10) {
  console.error(`SYNC_LIMIT은 1~10만 허용됩니다. 현재 값: ${LIMIT}`);
  process.exit(1);
}
// MAX_RANK 는 API 파라미터가 아니라 내려받은 결과를 거르는 로컬 기준이므로 상한을 두지 않는다
if (!Number.isInteger(MAX_RANK) || MAX_RANK < 1) {
  console.error(`SYNC_MAX_RANK는 1 이상의 정수여야 합니다. 현재 값: ${MAX_RANK}`);
  process.exit(1);
}
if (!Number.isFinite(DELAY_MS) || DELAY_MS < 0) {
  console.error(`SYNC_DELAY_MS는 0 이상의 숫자여야 합니다. 현재 값: ${DELAY_MS}`);
  process.exit(1);
}
// 시간당 10회 한도를 넘는 배치는 애초에 허용하지 않는다
if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1 || BATCH_SIZE > 10) {
  console.error(`SYNC_BATCH_SIZE는 1~10만 허용됩니다. 현재 값: ${BATCH_SIZE}`);
  process.exit(1);
}

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

// 이번 실행이 담당할 구간을 cursor 에서 이어받는다
const state = readState(STATE_PATH);
const cursor = normalizeCursor(state.keywordCursor, ALL_KEYWORDS.length);
const batch = takeBatch(ALL_KEYWORDS, cursor, BATCH_SIZE);

// 정상 응답을 받은 키워드 수. cursor 는 이만큼만 민다.
// 실패한 키워드는 포함하지 않으므로 다음 실행이 그 키워드부터 다시 시도한다.
let successfulRequests = 0;
// 중단시킨 오류. 한도 초과든 일반 오류든 남은 키워드는 호출하지 않는다.
let abortedBy = null;

for (const { keyword, category } of batch) {
  let items = [];
  try {
    items = await searchProducts(keyword, { limit: LIMIT, accessKey, secretKey });
  } catch (error) {
    // 한도 초과든 500/인증 오류든, 실패한 상태로 남은 키워드까지 계속 부르면
    // 시간당 호출 예산만 태운다. 첫 실패에서 배치를 통째로 멈춘다.
    abortedBy = error;
    stats.실패키워드.push(`${keyword} (${error.message})`);
    break;
  }
  // 200 응답이면 productData 가 비어 있어도 성공한 호출로 센다
  successfulRequests += 1;
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

// 정상 응답을 받은 만큼만 cursor 를 민다.
// 실패한 키워드는 다음 실행이 그 자리에서 다시 시도한다.
const nextCursor = advanceCursor(cursor, successfulRequests, ALL_KEYWORDS.length);

// undefined 필드는 JSON 에 남기지 않는다
const compact = (list) =>
  list.map((p) => JSON.parse(JSON.stringify(p)));

if (!dryRun) {
  writeFileSync(PRODUCTS_PATH, JSON.stringify(compact(products), null, 2) + '\n');
  writeFileSync(PENDING_PATH, JSON.stringify(compact(pending), null, 2) + '\n');
  writeState(STATE_PATH, {
    keywordCursor: nextCursor,
    lastRunAt: new Date().toISOString(),
    lastResult: abortedBy
      ? (abortedBy.isRateLimit ? 'rate_limited' : 'aborted')
      : 'ok',
  });
}

const batchEnd = cursor + batch.length;
console.log('── 쿠팡 수집 결과 ──');
console.log(
  `키워드 ${ALL_KEYWORDS.length}개 중 ${cursor + 1}~${batchEnd}번 ${batch.length}개 배정` +
    ` / 정상 응답 ${successfulRequests}개 / 조회 ${stats.조회}건`,
);
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
console.log(
  `다음 실행 cursor: ${nextCursor}` +
    `${nextCursor === 0 ? ' (한 바퀴 완료, 처음부터 다시)' : ''}` +
    `${dryRun ? ' — dry-run 이라 저장하지 않음' : ''}`,
);

if (abortedBy) {
  const reason = abortedBy.isRateLimit ? '시간당 호출 한도 초과' : 'API 오류';
  console.error(`수집 중단(${reason}): ${abortedBy.message}`);
  console.error(`  남은 키워드는 호출하지 않았습니다. 다음 실행이 ${nextCursor}번부터 다시 시도합니다.`);
  process.exitCode = 1;
} else if (successfulRequests === 0) {
  // 200 응답인데 productData 가 비어 있는 것은 정상이므로 조회 건수로 판정하지 않는다.
  // 한 번도 정상 응답을 못 받은 경우만 전체 실패로 본다.
  console.error('수집 실패: 정상 응답을 받은 요청이 0건입니다. 실패 키워드 로그를 확인하세요.');
  process.exitCode = 1;
}
