/**
 * 쿠팡 상품검색 API 는 시간당 10회만 부를 수 있다.
 * 키워드 68개를 한 번에 돌리면 첫 10개에서 막히므로,
 * 한 번 실행할 때 batch 개만 처리하고 다음 실행이 이어받도록
 * keyword cursor 를 sync-state.json 에 남긴다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 시간당 10회 한도에서 2회를 여유분으로 남긴다
export const DEFAULT_BATCH_SIZE = 8;

/** 저장된 cursor 가 깨졌거나 범위를 벗어나면 0 부터 다시 시작한다. */
export function normalizeCursor(cursor, total) {
  if (!Number.isInteger(total) || total <= 0) return 0;
  const n = Number(cursor);
  if (!Number.isInteger(n) || n < 0 || n >= total) return 0;
  return n;
}

/** cursor 부터 batchSize 개를 잘라낸다. 끝에 모자라면 남은 만큼만 준다. */
export function takeBatch(items, cursor, batchSize) {
  const start = normalizeCursor(cursor, items.length);
  const size = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE;
  return items.slice(start, start + size);
}

/**
 * 이번 실행에서 실제로 호출을 마친 개수만큼 cursor 를 민다.
 * 끝을 넘으면 0 으로 돌아가 다음 바퀴를 시작한다.
 */
export function advanceCursor(cursor, processed, total) {
  if (!Number.isInteger(total) || total <= 0) return 0;
  const next = normalizeCursor(cursor, total) + Math.max(0, Number(processed) || 0);
  return next >= total ? 0 : next;
}

/** 파일이 없거나 깨졌으면 cursor 0 으로 시작한다. */
export function readState(url) {
  try {
    const raw = JSON.parse(readFileSync(url, 'utf8'));
    return {
      keywordCursor: Number.isInteger(raw?.keywordCursor) ? raw.keywordCursor : 0,
      lastRunAt: raw?.lastRunAt ?? null,
      lastResult: raw?.lastResult ?? null,
    };
  } catch {
    return { keywordCursor: 0, lastRunAt: null, lastResult: null };
  }
}

export function writeState(url, state) {
  mkdirSync(dirname(fileURLToPath(url)), { recursive: true });
  writeFileSync(url, JSON.stringify(state, null, 2) + '\n');
}
