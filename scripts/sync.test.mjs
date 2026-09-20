/**
 * 쿠팡 수집 파이프라인 테스트.
 *
 * 실제 쿠팡 API 는 절대 부르지 않는다. 모든 HTTP 요청은 이 파일이 띄우는
 * 로컬 목 서버로 가며, COUPANG_API_HOST 로 주소를 바꿔 물린다.
 *
 *   node --test scripts/sync.test.mjs
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

// coupangApi.mjs 보다 먼저 평가되어야 실제 쿠팡 호스트가 굳는 것을 막는다
import './testEnv.mjs';
import {
  CoupangRateLimitError,
  parseHourlyRateLimit,
  searchProducts,
} from './coupangApi.mjs';
import {
  DEFAULT_BATCH_SIZE,
  advanceCursor,
  normalizeCursor,
  takeBatch,
} from './syncState.mjs';
import { ALL_KEYWORDS } from './keywords.mjs';

const execFileAsync = promisify(execFile);
const SYNC_SCRIPT = new URL('./sync-coupang.mjs', import.meta.url).pathname;

// ── 목 서버 ───────────────────────────────────────────────────────────────
// 요청을 모두 기록하고, 시나리오에 따라 정상/한도초과 응답을 돌려준다.
let server;
let baseUrl;
let requests = [];
/** (index) => 'ok' | 'rate-limit-403' | 'plain-403' | 'error-500' */
let responder = () => 'ok';

function product(i, { rank = 1, rocket = true } = {}) {
  return {
    productId: 900000 + i,
    productName: `테스트 소형 냉장고 ${i} 가로45 깊이50 높이85`,
    productPrice: 100000 + i,
    productImage: `https://thumbnail10.coupangcdn.com/thumbnails/remote/212x212ex/image/${i}.jpg`,
    productUrl: `https://link.coupang.com/a/testlink${i}`,
    categoryName: '가전',
    keyword: '테스트',
    rank,
    isRocket: rocket,
    isFreeShipping: true,
  };
}

before(async () => {
  server = createServer((req, res) => {
    const index = requests.length;
    requests.push(req.url);
    const mode = responder(index);

    if (mode === 'rate-limit-403') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          rCode: 'ERROR',
          rMessage: '시간당 호출 가능 횟수(10회)를 초과하였습니다. 사용 11회',
        }),
      );
      return;
    }
    if (mode === 'plain-403') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rCode: 'ERROR', rMessage: 'Invalid signature' }));
      return;
    }
    if (mode === 'error-500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }
    if (mode === 'empty-200') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rCode: '0', data: { productData: [] } }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        rCode: '0',
        data: { productData: [product(index)] },
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

function resetMock(fn = () => 'ok') {
  requests = [];
  responder = fn;
}

// ── 1. cursor 순환 (순수 함수) ────────────────────────────────────────────
describe('키워드 cursor 순환', () => {
  it('68개를 8개씩 돌면 9회차 뒤 0으로 돌아온다', () => {
    const total = 68;
    const size = 8;
    const seen = [];
    let cursor = 0;

    for (let run = 0; run < 9; run += 1) {
      seen.push({ cursor, size: takeBatch(Array.from({ length: total }), cursor, size).length });
      cursor = advanceCursor(cursor, seen[run].size, total);
    }

    assert.deepEqual(
      seen.map((s) => s.cursor),
      [0, 8, 16, 24, 32, 40, 48, 56, 64],
    );
    assert.deepEqual(
      seen.map((s) => s.size),
      [8, 8, 8, 8, 8, 8, 8, 8, 4],
      '마지막 9회차는 남은 4개만 처리한다',
    );
    assert.equal(cursor, 0, '9회차 뒤 cursor 는 0으로 복귀한다');
  });

  it('실제 키워드 개수도 8개씩 9회면 한 바퀴다', () => {
    assert.equal(ALL_KEYWORDS.length, 68);
    assert.equal(Math.ceil(ALL_KEYWORDS.length / DEFAULT_BATCH_SIZE), 9);
  });

  it('깨진 cursor 는 0으로 되돌린다', () => {
    assert.equal(normalizeCursor(-1, 68), 0);
    assert.equal(normalizeCursor(68, 68), 0);
    assert.equal(normalizeCursor(1.5, 68), 0);
    assert.equal(normalizeCursor('abc', 68), 0);
    assert.equal(normalizeCursor(64, 68), 64);
  });

  it('정상 응답을 받은 만큼만 cursor 를 민다', () => {
    // 8개 배정, 2개 성공 뒤 3번째에서 실패 → 다음은 실패한 2번부터 재시도
    assert.equal(advanceCursor(0, 2, 68), 2);
    assert.equal(advanceCursor(64, 4, 68), 0);
  });
});

// ── 2. 403 시간당 한도 감지 (순수 함수) ───────────────────────────────────
describe('시간당 한도 403 감지', () => {
  it('시간당 사용 횟수가 담긴 403 을 잡아낸다', () => {
    const hit = parseHourlyRateLimit(403, '시간당 호출 가능 횟수(10회)를 초과하였습니다. 사용 11회');
    assert.ok(hit);
    assert.equal(hit.usage, '10');
  });

  it('영문 메시지도 잡아낸다', () => {
    const hit = parseHourlyRateLimit(403, 'Exceeded hourly quota: 10 calls per hour');
    assert.ok(hit);
    assert.equal(hit.usage, '10');
  });

  it('시간당 표현이 없는 403 은 한도 초과로 보지 않는다', () => {
    assert.equal(parseHourlyRateLimit(403, 'Invalid signature'), null);
  });

  it('403 이 아닌 응답은 한도 초과로 보지 않는다', () => {
    assert.equal(parseHourlyRateLimit(429, '시간당 10회'), null);
    assert.equal(parseHourlyRateLimit(200, '시간당 10회'), null);
  });
});

// ── 3. searchProducts (목 서버) ───────────────────────────────────────────
describe('searchProducts', () => {
  const creds = { accessKey: 'test-access', secretKey: 'test-secret' };

  it('정상 응답에서 productData 를 돌려준다', async () => {
    process.env.COUPANG_API_HOST = baseUrl;
    resetMock();
    const { searchProducts: fresh } = await import(`./coupangApi.mjs?host=${Date.now()}`);
    const items = await fresh('소형 냉장고', { limit: 10, ...creds });
    assert.equal(items.length, 1);
    assert.equal(requests.length, 1);
    assert.match(requests[0], /limit=10/);
  });

  it('limit 이 범위를 벗어나면 요청을 보내기 전에 막는다', async () => {
    resetMock();
    await assert.rejects(
      () => searchProducts('소형 냉장고', { limit: 20, ...creds }),
      RangeError,
    );
    assert.equal(requests.length, 0, 'limit 검증 실패 시 HTTP 요청이 나가면 안 된다');
  });

  it('시간당 한도 403 은 CoupangRateLimitError 로 던진다', async () => {
    process.env.COUPANG_API_HOST = baseUrl;
    resetMock(() => 'rate-limit-403');
    const { searchProducts: fresh } = await import(`./coupangApi.mjs?host=${Date.now()}-rl`);
    await assert.rejects(
      () => fresh('소형 냉장고', { limit: 10, ...creds }),
      (err) => {
        assert.ok(err instanceof CoupangRateLimitError || err.isRateLimit);
        assert.equal(err.isRateLimit, true);
        return true;
      },
    );
  });

  it('시간당 표현이 없는 403 은 일반 오류로 던진다', async () => {
    process.env.COUPANG_API_HOST = baseUrl;
    resetMock(() => 'plain-403');
    const { searchProducts: fresh } = await import(`./coupangApi.mjs?host=${Date.now()}-p403`);
    await assert.rejects(
      () => fresh('소형 냉장고', { limit: 10, ...creds }),
      (err) => {
        assert.equal(err.isRateLimit, undefined);
        return true;
      },
    );
  });
});

// ── 4. sync-coupang.mjs 전체 실행 (목 서버 + 임시 데이터 디렉터리) ────────
function makeDataDir({ cursor = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cmpick-sync-'));
  writeFileSync(join(dir, 'products.json'), '[]\n');
  writeFileSync(join(dir, 'pending.json'), '[]\n');
  writeFileSync(
    join(dir, 'sync-state.json'),
    JSON.stringify({ keywordCursor: cursor, lastRunAt: null, lastResult: null }, null, 2) + '\n',
  );
  return dir;
}

async function runSync(dir, extraEnv = {}) {
  try {
    const { stdout } = await execFileAsync('node', [SYNC_SCRIPT], {
      env: {
        ...process.env,
        COUPANG_API_HOST: baseUrl,
        COUPANG_ACCESS_KEY: 'test-access',
        COUPANG_SECRET_KEY: 'test-secret',
        SYNC_DATA_DIR: dir,
        SYNC_DELAY_MS: '0',
        ...extraEnv,
      },
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

const readCursor = (dir) =>
  JSON.parse(readFileSync(join(dir, 'sync-state.json'), 'utf8')).keywordCursor;

describe('sync-coupang.mjs 전체 실행', () => {
  it('한 번 실행에 8개만 호출하고 cursor 를 8로 저장한다', async () => {
    resetMock();
    const dir = makeDataDir();
    const { code, stdout } = await runSync(dir);

    assert.equal(code, 0, stdout);
    assert.equal(requests.length, 8, '시간당 10회 한도 안에서 8회만 호출해야 한다');
    assert.equal(readCursor(dir), 8);
    assert.match(stdout, /1~8번 8개 배정/);
    assert.match(stdout, /다음 실행 cursor: 8/);
  });

  it('다음 실행은 저장된 cursor 부터 이어받는다', async () => {
    resetMock();
    const dir = makeDataDir({ cursor: 8 });
    const { code, stdout } = await runSync(dir);

    assert.equal(code, 0, stdout);
    assert.equal(requests.length, 8);
    assert.equal(readCursor(dir), 16);
    assert.match(stdout, /9~16번 8개 배정/);
    // 9번째 키워드가 실제로 요청에 담겼는지 확인
    assert.match(requests[0], new RegExp(encodeURIComponent(ALL_KEYWORDS[8].keyword)));
  });

  it('마지막 배치는 남은 4개만 처리하고 cursor 가 0으로 돌아간다', async () => {
    resetMock();
    const dir = makeDataDir({ cursor: 64 });
    const { code, stdout } = await runSync(dir);

    assert.equal(code, 0, stdout);
    assert.equal(requests.length, 4, '68개 중 마지막 4개만 남는다');
    assert.equal(readCursor(dir), 0);
    assert.match(stdout, /65~68번 4개 배정/);
    assert.match(stdout, /한 바퀴 완료/);
  });

  it('시간당 한도 403 을 만나면 그 즉시 멈추고 더 호출하지 않는다', async () => {
    // 0,1번은 정상. 3번째 호출에서 한도 초과.
    resetMock((i) => (i >= 2 ? 'rate-limit-403' : 'ok'));
    const dir = makeDataDir();
    const { code, stdout, stderr } = await runSync(dir);

    assert.equal(requests.length, 3, '한도 초과 응답을 받은 뒤 추가 호출이 없어야 한다');
    assert.equal(code, 1, '한도 초과 실행은 실패로 끝나야 한다');
    assert.match(stderr, /시간당 호출 한도 초과/);
    assert.equal(readCursor(dir), 2, '정상 응답 2개만큼만 cursor 를 민다');
    assert.match(stdout, /정상 응답 2개/);
  });

  it('HTTP 500 이 3번째 요청에서 나면 그 즉시 멈춘다', async () => {
    resetMock((i) => (i >= 2 ? 'error-500' : 'ok'));
    const dir = makeDataDir();
    const { code, stdout, stderr } = await runSync(dir);

    assert.equal(requests.length, 3, '500 이후 추가 호출이 없어야 한다');
    assert.equal(code, 1);
    assert.equal(readCursor(dir), 2, '실패한 2번 키워드부터 다시 시도해야 한다');
    assert.match(stderr, /수집 중단\(API 오류\)/);
    assert.match(stdout, /정상 응답 2개/);
  });

  it('인증 403(시간당 표현 없음)에서도 즉시 중단한다', async () => {
    resetMock((i) => (i >= 1 ? 'plain-403' : 'ok'));
    const dir = makeDataDir();
    const { code, stderr } = await runSync(dir);

    assert.equal(requests.length, 2, '인증 실패 뒤 추가 호출이 없어야 한다');
    assert.equal(code, 1);
    assert.equal(readCursor(dir), 1);
    assert.match(stderr, /수집 중단\(API 오류\)/);
  });

  it('200 + productData 빈 배열 8회는 전체 실패가 아니다', async () => {
    resetMock(() => 'empty-200');
    const dir = makeDataDir();
    const { code, stdout } = await runSync(dir);

    assert.equal(code, 0, '빈 결과는 실패가 아니다');
    assert.equal(requests.length, 8);
    assert.match(stdout, /정상 응답 8개 \/ 조회 0건/);
    assert.equal(readCursor(dir), 8, '빈 결과여도 cursor 는 8로 전진한다');
  });

  it('한 번도 정상 응답을 못 받으면 전체 실패로 본다', async () => {
    resetMock(() => 'error-500');
    const dir = makeDataDir();
    const { code, stderr } = await runSync(dir);

    assert.equal(code, 1);
    assert.equal(requests.length, 1, '첫 실패에서 바로 멈춘다');
    assert.equal(readCursor(dir), 0, '성공이 없으면 cursor 는 그대로다');
    assert.match(stderr, /수집 중단\(API 오류\)/);
  });

  it('dry-run 설정(SYNC_BATCH_SIZE=1)은 키워드 1개만 호출한다', async () => {
    resetMock();
    const dir = makeDataDir();
    const res = await execFileAsync('node', [SYNC_SCRIPT, '--dry-run'], {
      env: {
        ...process.env,
        COUPANG_API_HOST: baseUrl,
        COUPANG_ACCESS_KEY: 'test-access',
        COUPANG_SECRET_KEY: 'test-secret',
        SYNC_DATA_DIR: dir,
        SYNC_DELAY_MS: '0',
        // 워크플로가 dry_run=true 일 때 넘기는 값
        SYNC_BATCH_SIZE: '1',
      },
    });

    assert.equal(requests.length, 1, 'dry-run 검증은 1회만 써야 한다');
    assert.match(res.stdout, /1~1번 1개 배정/);
    assert.equal(readCursor(dir), 0, 'dry-run 은 cursor 를 저장하지 않는다');
  });

  it('SYNC_MAX_RANK 상한이 없어 999 도 그대로 동작한다', async () => {
    resetMock();
    const dir = makeDataDir();
    const { code, stdout } = await runSync(dir, { SYNC_MAX_RANK: '999' });

    assert.equal(code, 0, stdout);
    assert.match(stdout, /999위 밖 제외/);
    assert.equal(requests.length, 8);
  });

  it('SYNC_MAX_RANK 0 은 여전히 거부한다', async () => {
    resetMock();
    const dir = makeDataDir();
    const { code, stderr } = await runSync(dir, { SYNC_MAX_RANK: '0' });

    assert.equal(code, 1);
    assert.match(stderr, /SYNC_MAX_RANK는 1 이상/);
    assert.equal(requests.length, 0);
  });

  it('SYNC_BATCH_SIZE 가 10 을 넘으면 호출 전에 거부한다', async () => {
    resetMock();
    const dir = makeDataDir();
    const { code, stderr } = await runSync(dir, { SYNC_BATCH_SIZE: '20' });

    assert.equal(code, 1);
    assert.match(stderr, /SYNC_BATCH_SIZE는 1~10/);
    assert.equal(requests.length, 0);
  });

  it('dry-run 은 cursor 를 저장하지 않는다', async () => {
    resetMock();
    const dir = makeDataDir();
    const { code, stdout } = await runSync(dir, {}).then((r) => r);
    assert.equal(code, 0, stdout);

    resetMock();
    const dir2 = makeDataDir();
    const res = await execFileAsync('node', [SYNC_SCRIPT, '--dry-run'], {
      env: {
        ...process.env,
        COUPANG_API_HOST: baseUrl,
        COUPANG_ACCESS_KEY: 'test-access',
        COUPANG_SECRET_KEY: 'test-secret',
        SYNC_DATA_DIR: dir2,
        SYNC_DELAY_MS: '0',
      },
    });
    assert.equal(readCursor(dir2), 0, 'dry-run 은 상태를 바꾸지 않는다');
    assert.match(res.stdout, /dry-run 이라 저장하지 않음/);
  });
});

// ── 5. 안전장치 ──────────────────────────────────────────────────────────
describe('실제 쿠팡 API 차단', () => {
  it('테스트 중 API 호스트는 언제나 로컬이다', () => {
    assert.match(process.env.COUPANG_API_HOST, /^http:\/\/127\.0\.0\.1:/);
    assert.ok(
      !process.env.COUPANG_API_HOST.includes('coupang.com'),
      '테스트가 실제 쿠팡 서버를 가리키면 안 된다',
    );
  });
});

// ── 6. 워크플로 설정 ──────────────────────────────────────────────────────
describe('워크플로 설정', () => {
  const yml = readFileSync(new URL('../.github/workflows/sync-coupang.yml', import.meta.url), 'utf8');

  it('자동 schedule 이 꺼져 있다', () => {
    const active = yml
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    assert.ok(!/^\s*schedule:/m.test(active), '활성화된 schedule 트리거가 있으면 안 된다');
    assert.ok(!/^\s*-\s*cron:/m.test(active), '활성화된 cron 이 있으면 안 된다');
    assert.match(active, /^\s*workflow_dispatch:/m, 'workflow_dispatch 는 남아 있어야 한다');
  });

  it('dry-run 은 1회, 실제 수집은 8회로 배치를 나눈다', () => {
    assert.match(yml, /SYNC_BATCH_SIZE:\s*\$\{\{\s*inputs\.dry_run\s*&&\s*'1'\s*\|\|\s*'8'\s*\}\}/);
  });

  it('cursor 파일을 함께 커밋한다', () => {
    assert.match(yml, /git add .*src\/data\/sync-state\.json/);
  });
});
