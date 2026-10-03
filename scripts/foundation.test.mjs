/**
 * Foundation 안전장치 테스트.
 *
 * 이 저장소는 쿠팡 Search API 를 직접 부르지 않는다. 그 사실이 코드로
 * 유지되는지 매번 확인한다. 실제 쿠팡 요청은 0회이며, 네트워크 없이
 * 통과해야 한다.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CoordinatorUnavailableError,
  LiveModeBlockedError,
  MockInProductionError,
  createCoordinatorClient,
  keywordHash,
  resolveMode,
} from './coordinator/client.mjs';
import { MOCK_CATALOG, MOCK_ID_PREFIX, findMockLeaks } from './coordinator/mockCatalog.mjs';
import { validateData } from './validate-data.mjs';
import { ALL_KEYWORDS } from './keywords.mjs';
import { DEFAULT_BATCH_SIZE, advanceCursor, normalizeCursor, takeBatch } from './syncState.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const PRODUCTION_HOST = 'api-gateway.coupang.com';

// ── 네트워크 차단 ─────────────────────────────────────────────────────────
// 어떤 테스트도 바깥으로 나가면 안 된다. fetch 를 막아 두고, 나가려 하면
// 그 자리에서 실패시킨다.
const realFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = async (input) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? input);
    throw new Error(`테스트 중 외부 요청이 시도됐습니다: ${url}`);
  };
});
after(() => {
  globalThis.fetch = realFetch;
});

// ── 소스 수집 ─────────────────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'docs']);

function collectFiles(dir, exts, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, exts, found);
    else if (exts.some((e) => entry.endsWith(e))) found.push(full);
  }
  return found;
}

/** 주석을 지운다. 문서와 설명은 검사 대상이 아니다. */
function stripJsComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
function stripYamlComments(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/(^|\s)#.*$/, '$1'))
    .join('\n');
}

// 이 파일 자신은 탐지할 문자열을 그대로 들고 있으므로 스캔에서 뺀다.
// 빼는 파일은 이것 하나뿐이고, 아래에서 스캔 대상이 실제로 모였는지 확인한다.
const SELF = 'scripts/foundation.test.mjs';

const executableSources = [
  ...collectFiles(join(ROOT, 'scripts'), ['.mjs', '.js']),
  ...collectFiles(join(ROOT, 'src'), ['.ts', '.tsx', '.js', '.mjs']),
]
  .map((path) => ({
    path: relative(ROOT, path),
    code: stripJsComments(readFileSync(path, 'utf8')),
  }))
  .filter((f) => f.path !== SELF);

const workflows = collectFiles(join(ROOT, '.github'), ['.yml', '.yaml']).map((path) => ({
  path: relative(ROOT, path),
  code: stripYamlComments(readFileSync(path, 'utf8')),
  raw: readFileSync(path, 'utf8'),
}));

// ── 1. production host 직접호출 금지 ──────────────────────────────────────
describe('production Coupang host 직접호출 차단', () => {
  it('실행 가능한 소스에 production host 가 없다', () => {
    const hits = executableSources.filter((f) => f.code.includes(PRODUCTION_HOST));
    assert.deepEqual(
      hits.map((f) => f.path),
      [],
      '이 저장소는 쿠팡 API 를 직접 부르지 않는다 (docs/coupang-api-policy.md)',
    );
  });

  it('workflow 에도 production host 가 없다', () => {
    const hits = workflows.filter((f) => f.code.includes(PRODUCTION_HOST));
    assert.deepEqual(hits.map((f) => f.path), []);
  });

  it('쿠팡 오픈 API 경로를 직접 쓰지 않는다', () => {
    const hits = executableSources.filter((f) => f.code.includes('affiliate_open_api'));
    assert.deepEqual(hits.map((f) => f.path), []);
  });

  it('쿠팡 요청에 쓰는 자체 HMAC 서명 코드가 없다', () => {
    // HMAC 자체를 막는 게 아니라 '쿠팡 요청 서명' 을 막는다.
    // 세션 토큰 같은 쿠팡과 무관한 용도까지 막으면 가드가 엉뚱한 곳을
    // 때리고, 결국 가드를 무력화하는 방향으로 고치게 된다.
    // 쿠팡 흔적(호스트·오픈 API 경로·쿠팡 키)과 같은 파일에 있을 때만 잡는다.
    const hits = executableSources.filter((f) => {
      const signs = /createHmac\s*\(/.test(f.code) || f.code.includes('HmacSHA256');
      if (!signs) return false;
      return (
        f.code.includes(PRODUCTION_HOST) ||
        f.code.includes('affiliate_open_api') ||
        /COUPANG_(SECRET|ACCESS)_KEY/.test(f.code) ||
        /coupang/i.test(f.code)
      );
    });
    assert.deepEqual(
      hits.map((f) => f.path),
      [],
      '쿠팡 요청 서명은 Coordinator 만 한다',
    );
  });

  it('실행 파일 수집이 비어 있지 않다', () => {
    // 검사 대상이 0건이면 위 테스트들이 의미 없이 통과한다
    assert.ok(executableSources.length > 5, `수집된 실행 파일 ${executableSources.length}개`);
    assert.ok(workflows.length >= 1, `수집된 workflow ${workflows.length}개`);

    const paths = executableSources.map((f) => f.path);
    for (const must of ['scripts/coordinator/client.mjs', 'scripts/validate-data.mjs']) {
      assert.ok(paths.includes(must), `${must} 가 스캔에서 빠졌다`);
    }
    assert.ok(paths.some((p) => p.startsWith('src/')), 'src/ 가 스캔에서 빠졌다');
  });
});

// ── 2~3. Secret 직접사용 금지 ─────────────────────────────────────────────
describe('Coupang Secret 직접사용 차단', () => {
  for (const key of ['COUPANG_SECRET_KEY', 'COUPANG_ACCESS_KEY']) {
    it(`실행 코드에서 ${key} 를 쓰지 않는다`, () => {
      const hits = executableSources.filter((f) => f.code.includes(key));
      assert.deepEqual(
        hits.map((f) => f.path),
        [],
        `${key} 는 Coordinator 실행환경에만 둔다`,
      );
    });

    it(`workflow 에서 ${key} 를 쓰지 않는다`, () => {
      const hits = workflows.filter((f) => f.code.includes(key));
      assert.deepEqual(hits.map((f) => f.path), []);
    });
  }

  it('workflow 가 secrets 컨텍스트로 쿠팡 키를 넘기지 않는다', () => {
    const hits = workflows.filter((f) => /secrets\.COUPANG/i.test(f.code));
    assert.deepEqual(hits.map((f) => f.path), []);
  });
});

// ── 4. 자동 schedule 금지 ─────────────────────────────────────────────────
describe('자동 Coupang schedule 차단', () => {
  it('어떤 workflow 에도 활성 schedule 이 없다', () => {
    for (const wf of workflows) {
      assert.ok(
        !/^\s*schedule:/m.test(wf.code),
        `${wf.path} 에 활성 schedule 이 있다`,
      );
      assert.ok(!/^\s*-\s*cron:/m.test(wf.code), `${wf.path} 에 활성 cron 이 있다`);
    }
  });

  it('쿠팡 수집 workflow 자체가 없다', () => {
    const collectors = workflows.filter(
      (f) => /sync-coupang|coupang.*수집|수집.*coupang/i.test(f.path + f.code),
    );
    assert.deepEqual(collectors.map((f) => f.path), []);
  });
});

// ── 5~6. Coordinator client ───────────────────────────────────────────────
describe('Coordinator client', () => {
  it('기본 모드는 mock 이고 live 는 거짓이다', () => {
    const resolved = resolveMode({});
    assert.equal(resolved.mode, 'mock');
    assert.equal(resolved.live, false);
  });

  it('모드만 live 로 줘도 live 가 되지 않는다', () => {
    assert.equal(resolveMode({ COUPANG_COORDINATOR_MODE: 'live' }).live, false);
  });

  it('허용 플래그만 켜도 live 가 되지 않는다', () => {
    assert.equal(resolveMode({ ALLOW_COUPANG_LIVE: 'true' }).live, false);
  });

  it('둘 다 명시해야 live 로 해석된다', () => {
    const resolved = resolveMode({
      COUPANG_COORDINATOR_MODE: 'live',
      ALLOW_COUPANG_LIVE: 'true',
    });
    assert.equal(resolved.live, true);
  });

  it('기본 구현은 mock 이고 실제 API 를 부르지 않는다', async () => {
    const client = createCoordinatorClient({ env: {} });
    const res = await client.searchProducts({ keyword: '원룸 미니 냉장고' });

    assert.equal(client.mode, 'mock');
    assert.equal(res.status, 'mock');
    assert.equal(res.quota.actualApiCalled, false);
    assert.ok(res.products.length > 0);
    assert.ok(res.products.every((p) => p.isMock === true));
  });

  it('카테고리로 걸러 최대 10건까지 돌려준다', async () => {
    const client = createCoordinatorClient({ env: {} });
    const res = await client.searchProducts({
      keyword: '소형 냉장고',
      category: 'refrigerator',
    });
    assert.ok(res.products.length > 0);
    assert.ok(res.products.length <= 10, 'Search API 1회 결과는 최대 10건이다');
    assert.ok(res.products.every((p) => p.category === 'refrigerator'));
  });

  it('live 를 명시해도 Foundation 에서는 막힌다', async () => {
    const client = createCoordinatorClient({
      env: { COUPANG_COORDINATOR_MODE: 'live', ALLOW_COUPANG_LIVE: 'true' },
    });
    await assert.rejects(
      () => client.searchProducts({ keyword: '원룸 미니 냉장고' }),
      LiveModeBlockedError,
    );
  });

  it('transport 가 실제 호출을 보고하면 거부한다', async () => {
    const client = createCoordinatorClient({
      env: {},
      transport: async () => ({ status: 'mock', products: [], quota: { actualApiCalled: true } }),
    });
    await assert.rejects(
      () => client.searchProducts({ keyword: '테스트' }),
      LiveModeBlockedError,
    );
  });

  it('빈 키워드는 거부한다', async () => {
    const client = createCoordinatorClient({ env: {} });
    await assert.rejects(() => client.searchProducts({ keyword: '  ' }), TypeError);
  });

  it('같은 키워드는 같은 캐시 키를 만든다', () => {
    assert.equal(keywordHash(' 원룸 냉장고 ', 'refrigerator'), keywordHash('원룸 냉장고', 'refrigerator'));
    assert.notEqual(keywordHash('원룸 냉장고'), keywordHash('원룸 세탁기'));
  });

  it('큐 잡에 프로젝트와 캐시 키가 담긴다', () => {
    const client = createCoordinatorClient({ env: {} });
    const job = client.buildQueueJob({ keyword: '원룸 미니 냉장고', category: 'refrigerator' });
    assert.equal(job.project, 'cmpick');
    assert.equal(job.status, 'pending');
    assert.equal(job.keywordHash, keywordHash('원룸 미니 냉장고', 'refrigerator'));
  });
});

// ── 7. fail-closed ────────────────────────────────────────────────────────
describe('Coordinator 장애 시 fail-closed', () => {
  it('Coordinator 가 죽으면 직접 호출로 넘어가지 않고 멈춘다', async () => {
    const client = createCoordinatorClient({
      env: {},
      transport: async () => {
        throw new Error('coordinator DB 접속 실패');
      },
    });
    await assert.rejects(
      () => client.searchProducts({ keyword: '원룸 미니 냉장고' }),
      CoordinatorUnavailableError,
    );
  });

  it('응답을 해석할 수 없어도 멈춘다', async () => {
    const client = createCoordinatorClient({ env: {}, transport: async () => null });
    await assert.rejects(
      () => client.searchProducts({ keyword: '원룸 미니 냉장고' }),
      CoordinatorUnavailableError,
    );
  });
});

// ── 8. mock 상품 ──────────────────────────────────────────────────────────
describe('mock 상품', () => {
  it('mock 목록이 상품 스키마를 지킨다', () => {
    // mock 표시를 떼고 id 도 바꿔, 누수 규칙이 아니라 형태만 보게 한다
    const asProducts = MOCK_CATALOG.map(({ isMock, id, ...rest }, i) => ({
      ...rest,
      id: `chk-${String(i).padStart(3, '0')}`,
    }));
    const errors = validateData({
      products: asProducts,
      pending: [],
      state: { keywordCursor: 0, lastRunAt: null, lastResult: null },
    });
    assert.deepEqual(errors, [], errors.join('\n'));
  });

  it('mock 상품은 실제 제휴 링크를 쓰지 않는다', () => {
    for (const item of MOCK_CATALOG) {
      assert.ok(!item.coupangUrl.includes('coupang.com'), `${item.id} 가 실제 쿠팡 링크를 쓴다`);
      assert.ok(item.id.startsWith(MOCK_ID_PREFIX));
      assert.equal(item.isMock, true);
    }
  });

  it('운영 환경에서는 mock 을 내주지 않는다', async () => {
    const client = createCoordinatorClient({ env: { NODE_ENV: 'production' } });
    await assert.rejects(
      () => client.searchProducts({ keyword: '원룸 미니 냉장고' }),
      MockInProductionError,
    );
  });

  it('운영 데이터에 mock 이 섞이면 validator 가 잡는다', () => {
    const errors = validateData({
      products: [{ ...MOCK_CATALOG[0] }],
      pending: [],
      state: { keywordCursor: 0, lastRunAt: null, lastResult: null },
    });
    assert.ok(errors.some((e) => /mock 상품이 운영 데이터에 섞였습니다/.test(e)), errors.join('\n'));
  });

  it('findMockLeaks 가 실제 데이터에서는 아무것도 찾지 않는다', () => {
    const real = JSON.parse(readFileSync(join(ROOT, 'src/data/products.json'), 'utf8'));
    assert.deepEqual(findMockLeaks(real), []);
  });
});

// ── 9. CI workflow ────────────────────────────────────────────────────────
describe('CI workflow', () => {
  const ci = workflows.find((f) => f.path.endsWith('ci.yml'));

  it('CI workflow 가 있다', () => assert.ok(ci));

  it('test / lint / build / validator 만 돌린다', () => {
    for (const cmd of ['npm run test', 'npm run lint', 'npm run build', 'npm run validate']) {
      assert.ok(ci.code.includes(cmd), `${cmd} 가 CI 에 없다`);
    }
    assert.ok(!ci.code.includes('sync-coupang'), 'CI 가 쿠팡 수집을 돌리면 안 된다');
  });
});

// ── 키워드 cursor (Coordinator 큐 제출 순서용) ────────────────────────────
describe('키워드 cursor', () => {
  it('68개를 8개씩 돌면 9회차 뒤 0으로 돌아온다', () => {
    const total = ALL_KEYWORDS.length;
    let cursor = 0;
    const sizes = [];
    for (let run = 0; run < 9; run += 1) {
      const batch = takeBatch(ALL_KEYWORDS, cursor, DEFAULT_BATCH_SIZE);
      sizes.push(batch.length);
      cursor = advanceCursor(cursor, batch.length, total);
    }
    assert.deepEqual(sizes, [8, 8, 8, 8, 8, 8, 8, 8, 4]);
    assert.equal(cursor, 0);
  });

  it('깨진 cursor 는 0으로 되돌린다', () => {
    assert.equal(normalizeCursor(-1, 68), 0);
    assert.equal(normalizeCursor(68, 68), 0);
    assert.equal(normalizeCursor(64, 68), 64);
  });
});
