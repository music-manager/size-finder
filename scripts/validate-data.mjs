#!/usr/bin/env node
/**
 * 수집 직후, 커밋 직전에 데이터 파일만 검사한다.
 *
 *   node scripts/validate-data.mjs
 *
 * 빌드를 다시 돌리지 않고 쿠팡 API 도 부르지 않는다.
 * 파일 세 개를 읽어 구조만 본다.
 *
 * 기존에 손으로 채운 60종은 productId / price 가 없고 imageUrl 이 빈
 * 문자열인 것이 정상이므로, 그 셋은 있을 때만 형식을 본다.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_KEYWORDS } from './keywords.mjs';

const LAST_RESULTS = [null, 'ok', 'rate_limited', 'aborted'];

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isPositiveNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** 항목 하나의 공통 필수값을 본다. */
function checkCommon(item, where, index, errors) {
  const at = `${where}[${index}]`;
  for (const field of ['id', 'name', 'category', 'coupangUrl']) {
    if (!isNonEmptyString(item?.[field])) {
      errors.push(`${at}.${field}: 비어 있지 않은 문자열이어야 합니다 (받은 값: ${JSON.stringify(item?.[field])})`);
    }
  }
  if (!Array.isArray(item?.tags)) {
    errors.push(`${at}.tags: 배열이어야 합니다 (받은 값: ${JSON.stringify(item?.tags)})`);
  }
  // 아래 셋은 기존 데이터에 없을 수 있으므로 있을 때만 형식을 본다
  if (item?.price !== undefined && !isPositiveNumber(item.price)) {
    errors.push(`${at}.price: 0보다 큰 유한한 숫자여야 합니다 (받은 값: ${JSON.stringify(item.price)})`);
  }
  if (item?.imageUrl !== undefined && typeof item.imageUrl !== 'string') {
    errors.push(`${at}.imageUrl: 문자열이어야 합니다 (빈 문자열은 허용, 받은 값: ${JSON.stringify(item.imageUrl)})`);
  }
}

/** products 에 들어간 상품은 치수가 있어야 한다. */
function checkDimensions(item, index, errors) {
  const at = `products[${index}]`;
  const d = item?.dimensions;
  if (!d || typeof d !== 'object' || Array.isArray(d)) {
    errors.push(`${at}.dimensions: 객체여야 합니다 (받은 값: ${JSON.stringify(d)})`);
    return;
  }
  for (const axis of ['width', 'depth', 'height']) {
    if (!isPositiveNumber(d[axis])) {
      errors.push(`${at}.dimensions.${axis}: 0보다 큰 유한한 숫자여야 합니다 (받은 값: ${JSON.stringify(d[axis])})`);
    }
  }
}

/** 두 목록을 합쳐 키가 겹치는지 본다. */
function checkDuplicates(entries, key, errors, { skipMissing = false } = {}) {
  const seen = new Map();
  for (const { item, where, index } of entries) {
    const value = item?.[key];
    if (skipMissing && (value === undefined || value === null || value === '')) continue;
    if (value === undefined || value === null) continue;
    const prev = seen.get(value);
    if (prev) {
      errors.push(`${key} 중복: ${JSON.stringify(value)} — ${prev} 와 ${where}[${index}]`);
    } else {
      seen.set(value, `${where}[${index}]`);
    }
  }
}

function checkState(state, totalKeywords, errors) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    errors.push(`sync-state.json: 객체여야 합니다 (받은 값: ${JSON.stringify(state)})`);
    return;
  }

  const cursor = state.keywordCursor;
  if (!Number.isInteger(cursor) || cursor < 0 || cursor >= totalKeywords) {
    errors.push(
      `sync-state.json.keywordCursor: 0 이상 ${totalKeywords} 미만의 정수여야 합니다 (받은 값: ${JSON.stringify(cursor)})`,
    );
  }

  const last = state.lastResult ?? null;
  if (!LAST_RESULTS.includes(last)) {
    errors.push(
      `sync-state.json.lastResult: ${LAST_RESULTS.map((v) => JSON.stringify(v)).join(' / ')} 중 하나여야 합니다 (받은 값: ${JSON.stringify(state.lastResult)})`,
    );
  }

  const runAt = state.lastRunAt ?? null;
  if (runAt !== null) {
    if (typeof runAt !== 'string' || Number.isNaN(Date.parse(runAt))) {
      errors.push(
        `sync-state.json.lastRunAt: null 이거나 해석 가능한 ISO 날짜 문자열이어야 합니다 (받은 값: ${JSON.stringify(runAt)})`,
      );
    }
  }
}

/**
 * 파싱이 끝난 데이터를 검사해 오류 메시지 목록을 돌려준다.
 * 빈 배열이면 통과다.
 */
export function validateData({ products, pending, state, totalKeywords = ALL_KEYWORDS.length }) {
  const errors = [];

  if (!Array.isArray(products)) {
    errors.push(`products.json: 배열이어야 합니다 (받은 값: ${typeof products})`);
  }
  if (!Array.isArray(pending)) {
    errors.push(`pending.json: 배열이어야 합니다 (받은 값: ${typeof pending})`);
  }
  if (errors.length) {
    // 배열이 아니면 항목 검사는 의미가 없다
    checkState(state, totalKeywords, errors);
    return errors;
  }

  products.forEach((item, i) => {
    checkCommon(item, 'products', i, errors);
    checkDimensions(item, i, errors);
  });
  // 대기열은 치수를 아직 모르는 상태이므로 dimensions 를 요구하지 않는다
  pending.forEach((item, i) => checkCommon(item, 'pending', i, errors));

  const entries = [
    ...products.map((item, index) => ({ item, where: 'products', index })),
    ...pending.map((item, index) => ({ item, where: 'pending', index })),
  ];
  checkDuplicates(entries, 'id', errors);
  // 손으로 채운 기존 상품에는 productId 가 없으므로 있는 것끼리만 본다
  checkDuplicates(entries, 'productId', errors, { skipMissing: true });

  checkState(state, totalKeywords, errors);
  return errors;
}

/** 파일을 읽어 파싱한다. 실패하면 오류 목록에 남기고 undefined 를 돌려준다. */
export function readJsonFile(url, label, errors) {
  let raw;
  try {
    raw = readFileSync(url, 'utf8');
  } catch (error) {
    errors.push(`${label}: 읽을 수 없습니다 — ${error.message}`);
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    errors.push(`${label}: JSON 파싱 실패 — ${error.message}`);
    return undefined;
  }
}

function main() {
  const dataDir = process.env.SYNC_DATA_DIR
    ? pathToFileURL(resolve(process.env.SYNC_DATA_DIR) + '/')
    : new URL('../src/data/', import.meta.url);

  const parseErrors = [];
  const products = readJsonFile(new URL('products.json', dataDir), 'products.json', parseErrors);
  const pending = readJsonFile(new URL('pending.json', dataDir), 'pending.json', parseErrors);
  const state = readJsonFile(new URL('sync-state.json', dataDir), 'sync-state.json', parseErrors);

  const errors = parseErrors.length
    ? parseErrors
    : validateData({ products, pending, state });

  if (errors.length) {
    console.error('── 데이터 검증 실패 ──');
    errors.slice(0, 30).forEach((e) => console.error(`  ✗ ${e}`));
    if (errors.length > 30) console.error(`  … 외 ${errors.length - 30}건`);
    console.error(`총 ${errors.length}건. 이 데이터는 커밋하지 않습니다.`);
    process.exitCode = 1;
    return;
  }

  console.log('── 데이터 검증 통과 ──');
  console.log(`  products ${products.length}종 / pending ${pending.length}건`);
  console.log(`  keywordCursor ${state.keywordCursor} / lastResult ${JSON.stringify(state.lastResult ?? null)}`);
}

// 직접 실행했을 때만 파일을 읽는다 (테스트는 validateData 만 부른다)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
