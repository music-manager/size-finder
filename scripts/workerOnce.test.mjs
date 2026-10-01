/**
 * 중앙 worker-once adapter 테스트 (차종픽 기준 구조).
 *
 * 외부 네트워크 0회. 중앙 Coordinator 와 worker-once 는 아래 mock 이 흉내 낸다.
 * 토큰은 매 실행마다 난수로 만든다(저장소에 토큰 값을 두지 않는다).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CURRENT_WORKER_CREDENTIAL,
  WORKER_PROJECT_ID,
  WORKER_TOKEN_ENV,
  checkWorkerOnce,
  describeWorkerCredentialState,
  evaluateSearchPrecheck,
  evaluateWorkerPrecheck,
  evaluateWorkerTarget,
  isAuthRejected,
  isCentralRequestId,
  parseCoordinatorStatus,
  parseWorkerResponse,
  resolveWorkerCredential,
  resolveWorkerOnceUrl,
  runWorkerOnce,
  workerCallAllowed,
} from './coordinator/workerOnce.mjs';
import { PROJECT as COORDINATOR_PROJECT, createCoordinatorClient } from './coordinator/client.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

// ── 네트워크 차단 ─────────────────────────────────────────────
const realFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = async (input) => {
    throw new Error(`테스트 중 외부 요청이 시도됐습니다: ${String(input)}`);
  };
});
after(() => {
  globalThis.fetch = realFetch;
});

// ── 고정값 (토큰은 난수) ──────────────────────────────────────
const token = () => randomBytes(24).toString('hex');
const COORDINATOR_TOKEN = token();
const WORKER_TOKEN = token();
const NO_PROCESS_ONE_TOKEN = token();
const OTHER_PROJECT_TOKEN = token();
const UNKNOWN_TOKEN = token();
const WRONG_PROJECT_ID_TOKEN = token();
const COORDINATOR_URL = 'https://central-test.invalid/functions/v1/coupang-coordinator';
const WORKER_URL = 'https://central-test.invalid/functions/v1/coupang-worker-once';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const REQUEST_ID = randomUUID();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/**
 * 중앙 인증 계약 mock:
 *   Bearer <token> → SHA-256 → coupang_auth_client(token_hash, 'process_one')
 *   → active=true + allowed_actions 에 process_one + allowed_projects 에 요청 project
 *   하나라도 어긋나면 HTTP 401 { error: 'UNAUTHORIZED' }
 */
// production 중앙 DB 와 같은 project 식별자: coupang_api_queue.project · cmpick-netlify.allowed_projects = ['cmpick']
const CENTRAL_CLIENTS = [
  { tokenSha256: sha256(WORKER_TOKEN), active: true, allowedActions: ['process_one'], allowedProjects: ['cmpick'] },
  { tokenSha256: sha256(COORDINATOR_TOKEN), active: true, allowedActions: ['status', 'search', 'enqueue', 'cache_lookup'], allowedProjects: ['cmpick'] },
  { tokenSha256: sha256(NO_PROCESS_ONE_TOKEN), active: true, allowedActions: ['status', 'search'], allowedProjects: ['cmpick'] },
  { tokenSha256: sha256(OTHER_PROJECT_TOKEN), active: true, allowedActions: ['process_one'], allowedProjects: ['kkultem-pick'] },
  // 잘못된 식별자(size-finder)로 등록된 worker client — cmpick queue job 을 처리할 수 없어야 한다
  { tokenSha256: sha256(WRONG_PROJECT_ID_TOKEN), active: true, allowedActions: ['process_one'], allowedProjects: ['size-finder'] },
];

function statusPayload(overrides = {}) {
  const base = {
    status: 'ok',
    actualApiCalled: false,
    control: {
      api_type: 'search',
      blocked_until: null,
      blocked_reason: null,
      last_sent_at: new Date(NOW - 60 * 60_000).toISOString(),
    },
    quota: { rolling60m: 0, rolling24h: 3, normalLimit: 3, hardLimit: 4, dailyLimit: 36, minIntervalMinutes: 21 },
    queuePending: 1,
    queueProcessing: 0,
  };
  return {
    ...base,
    ...overrides,
    control: { ...base.control, ...(overrides.control ?? {}) },
    quota: { ...base.quota, ...(overrides.quota ?? {}) },
  };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** 중앙 mock. 요청 기록을 남긴다. worker 응답은 workerMode 로 바꾼다. */
function centralMock({ status = statusPayload(), statusHttp = 200, workerMode = 'auth' } = {}) {
  const calls = { status: 0, worker: 0, other: 0, statusAuth: [], statusBodies: [], workerAuth: [], workerBodies: [] };
  const fetchImpl = async (url, init = {}) => {
    const bearer = String(init.headers?.authorization ?? '').replace(/^Bearer /, '');
    const body = JSON.parse(String(init.body ?? '{}'));
    if (url === COORDINATOR_URL) {
      calls.status += 1;
      calls.statusAuth.push(sha256(bearer));
      calls.statusBodies.push(body);
      const client = CENTRAL_CLIENTS.find((item) => item.tokenSha256 === sha256(bearer));
      if (!client || !client.allowedActions.includes('status') || !client.allowedProjects.includes(String(body.project))) {
        return jsonResponse(401, { error: 'UNAUTHORIZED' });
      }
      return jsonResponse(statusHttp, status);
    }
    if (url === WORKER_URL) {
      calls.worker += 1;
      calls.workerAuth.push(sha256(bearer));
      calls.workerBodies.push(body);
      if (workerMode === 'network') throw new TypeError('fetch failed');
      if (workerMode === '5xx') return jsonResponse(503, { error: 'UNAVAILABLE' });
      if (workerMode === 'non-json') return new Response('<html>', { status: 502 });
      const client = CENTRAL_CLIENTS.find((item) => item.tokenSha256 === sha256(bearer));
      const authorized =
        client !== undefined &&
        client.active &&
        body.action === 'process_one' &&
        client.allowedActions.includes('process_one') &&
        client.allowedProjects.includes(String(body.project));
      if (!authorized) return jsonResponse(401, { error: 'UNAUTHORIZED' });
      return jsonResponse(200, {
        status: 'success',
        actualApiCalled: true,
        job: { status: 'done', attempts: 1, created_at: new Date(NOW).toISOString() },
      });
    }
    calls.other += 1;
    throw new Error(`예상하지 못한 요청: ${url}`);
  };
  return { calls, fetchImpl };
}

function env(overrides = {}) {
  return {
    NODE_ENV: 'production',
    COUPANG_COORDINATOR_MODE: 'live',
    ALLOW_COUPANG_LIVE: 'true',
    COUPANG_COORDINATOR_URL: COORDINATOR_URL,
    COUPANG_COORDINATOR_TOKEN: COORDINATOR_TOKEN,
    [WORKER_TOKEN_ENV]: WORKER_TOKEN,
    ...overrides,
  };
}

function knownJob(overrides = {}) {
  return {
    requestId: REQUEST_ID,
    source: 'registry',
    enqueuedAt: null,
    observed: { status: 'pending', observedOn: '2026-09-29' },
    worker: null,
    ...overrides,
  };
}

async function run(options = {}) {
  const mock = centralMock(options.central);
  const logs = [];
  const result = await runWorkerOnce(options.requestId ?? REQUEST_ID, options.jobs ?? [knownJob(options.job)], {
    env: options.env ?? env(),
    fetchImpl: mock.fetchImpl,
    nowMs: NOW,
    log: (line) => logs.push(line),
  });
  return { result, calls: mock.calls, logs };
}

const totalRequests = (calls) => calls.status + calls.worker + calls.other;

// ── A. 인증 ──────────────────────────────────────────────────
describe('A. worker 전용 토큰 인증', () => {
  it('worker 토큰이 없으면 요청 0회', async () => {
    const { result, calls } = await run({ env: env({ [WORKER_TOKEN_ENV]: undefined }) });
    assert.equal(result.outcome, 'disabled');
    assert.equal(totalRequests(calls), 0);
  });

  it('worker 토큰이 빈 값(공백)이면 요청 0회', async () => {
    const { result, calls } = await run({ env: env({ [WORKER_TOKEN_ENV]: '   ' }) });
    assert.equal(result.outcome, 'disabled');
    assert.equal(totalRequests(calls), 0);
  });

  it('worker 토큰이 Coordinator 토큰과 같으면 요청 0회', async () => {
    const { result, calls } = await run({ env: env({ [WORKER_TOKEN_ENV]: COORDINATOR_TOKEN }) });
    assert.equal(result.outcome, 'disabled');
    assert.equal(totalRequests(calls), 0);
    assert.equal(resolveWorkerCredential(env({ [WORKER_TOKEN_ENV]: COORDINATOR_TOKEN })).state, 'same-as-coordinator');
  });

  it('NEXT_PUBLIC_ 이름으로 노출돼 있으면 올바른 토큰이 있어도 실패(요청 0회)', async () => {
    const leaked = env({ [`NEXT_PUBLIC_${WORKER_TOKEN_ENV}`]: WORKER_TOKEN });
    const { result, calls } = await run({ env: leaked });
    assert.equal(result.outcome, 'disabled');
    assert.equal(totalRequests(calls), 0);
    assert.equal(resolveWorkerCredential(leaked).state, 'public-name');
  });

  it('올바른 worker 토큰 → mock 200, worker 는 worker 토큰만 · status 는 Coordinator 토큰만', async () => {
    const { result, calls } = await run();
    assert.equal(result.outcome, 'worker-called');
    assert.equal(result.ok, true);
    assert.equal(result.audit.worker.httpStatus, 200);
    assert.equal(result.audit.worker.status, 'success');
    assert.equal(result.audit.worker.actualApiCalled, true);
    assert.equal(result.audit.worker.credential, CURRENT_WORKER_CREDENTIAL);
    assert.deepEqual(calls.workerAuth, [sha256(WORKER_TOKEN)]);
    assert.deepEqual(calls.statusAuth, [sha256(COORDINATOR_TOKEN)]);
    assert.deepEqual(calls.workerBodies, [{ action: 'process_one', project: 'cmpick', requestId: REQUEST_ID }]);
    assert.deepEqual(calls.statusBodies, [{ action: 'status', project: 'cmpick' }]);
    assert.equal(WORKER_PROJECT_ID, 'cmpick');
  });

  for (const [name, bad] of [
    ['process_one 권한 없음', NO_PROCESS_ONE_TOKEN],
    ['size-finder 식별자로 등록된 worker client (cmpick 아님)', WRONG_PROJECT_ID_TOKEN],
    ['다른 프로젝트 권한', OTHER_PROJECT_TOKEN],
    ['미등록 토큰', UNKNOWN_TOKEN],
  ]) {
    it(`${name} → mock 401, actualApiCalled=false, worker 1회만`, async () => {
      const { result, calls } = await run({ env: env({ [WORKER_TOKEN_ENV]: bad }) });
      assert.equal(result.outcome, 'worker-called');
      assert.equal(result.ok, false);
      assert.equal(result.audit.worker.httpStatus, 401);
      assert.equal(result.audit.worker.error, 'UNAUTHORIZED');
      assert.notEqual(result.audit.worker.actualApiCalled, true);
      assert.equal(calls.worker, 1);
      assert.ok(isAuthRejected(result.audit.worker));
    });
  }
});

// ── project 식별자 회귀 ────────────────────────────────────────
describe('project 식별자 — 기존 Coordinator 와 같은 cmpick', () => {
  it('worker project 는 기존 Coordinator PROJECT 와 같고, 그 값은 production queue 의 cmpick 이다', () => {
    assert.equal(COORDINATOR_PROJECT, 'cmpick');
    assert.equal(WORKER_PROJECT_ID, COORDINATOR_PROJECT);
    assert.equal(createCoordinatorClient({ env: {} }).buildQueueJob({ keyword: 'x' }).project, WORKER_PROJECT_ID);
  });

  it('worker adapter 소스는 project 를 하드코딩하지 않고 Coordinator PROJECT 를 그대로 쓴다', () => {
    const code = readFileSync(join(ROOT, 'scripts/coordinator/workerOnce.mjs'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.match(code, /export const WORKER_PROJECT_ID = COORDINATOR_PROJECT;/);
    assert.match(code, /project: WORKER_PROJECT_ID, requestId/);
    assert.doesNotMatch(code, /['"`]size-finder['"`]/, 'size-finder 는 중앙 project 식별자가 아니다');
  });

  it('status 와 worker-once 가 같은 project(cmpick)로 나간다', async () => {
    const { calls } = await run();
    assert.equal(calls.statusBodies[0].project, 'cmpick');
    assert.equal(calls.workerBodies[0].project, 'cmpick');
  });
});

// ── B. retry ─────────────────────────────────────────────────
describe('B. 자동 재시도 0회', () => {
  it('401 후 자동 재시도 없음, 같은 자격증명 기록으로 다시 누르면 요청 0회', async () => {
    const first = await run({ env: env({ [WORKER_TOKEN_ENV]: UNKNOWN_TOKEN }) });
    assert.equal(first.calls.worker, 1);
    const second = await run({ job: { worker: first.result.audit.worker } });
    assert.equal(second.result.outcome, 'already-called');
    assert.equal(totalRequests(second.calls), 0);
  });

  it('network error 도 1회로 끝난다', async () => {
    const { result, calls } = await run({ central: { workerMode: 'network' } });
    assert.equal(calls.worker, 1);
    assert.equal(result.audit.worker.outcome, 'network-error');
    assert.equal(result.ok, false);
  });

  it('5xx 도 1회로 끝난다', async () => {
    const { result, calls } = await run({ central: { workerMode: '5xx' } });
    assert.equal(calls.worker, 1);
    assert.equal(result.audit.worker.outcome, 'http-error');
    assert.equal(result.audit.worker.httpStatus, 503);
  });

  it('JSON 이 아닌 응답도 1회로 끝난다', async () => {
    const { result, calls } = await run({ central: { workerMode: 'non-json' } });
    assert.equal(calls.worker, 1);
    assert.equal(result.audit.worker.outcome, 'invalid-response');
  });

  it('이미 actualApiCalled=true 인 기록이 있으면 재처리 차단 (요청 0회)', async () => {
    const done = parseWorkerResponse(200, { status: 'success', actualApiCalled: true }, 'x', CURRENT_WORKER_CREDENTIAL);
    const { result, calls } = await run({ job: { worker: done } });
    assert.equal(result.outcome, 'already-called');
    assert.equal(totalRequests(calls), 0);
    // 401 이어도 actualApiCalled=true 면 인증 거부로 보지 않는다
    const weird = { ...parseWorkerResponse(401, { error: 'UNAUTHORIZED', actualApiCalled: true }, 'x', 'coordinator-token') };
    assert.equal(workerCallAllowed(weird), false);
  });

  it('다른 자격증명(Coordinator 토큰)으로 401 된 pending job 만 운영자 재실행 1회 허용', async () => {
    const rejected = parseWorkerResponse(401, { error: 'UNAUTHORIZED', actualApiCalled: false }, 'x', 'coordinator-token');
    assert.equal(workerCallAllowed(rejected, 'worker-token'), true);
    const { result, calls } = await run({ job: { worker: rejected } });
    assert.equal(result.outcome, 'worker-called');
    assert.equal(calls.worker, 1);
    assert.deepEqual(calls.workerAuth, [sha256(WORKER_TOKEN)]);
    // 같은 자격증명의 401 은 불허 · job 이 pending 이 아니면 불허 · 필드 없는 옛 기록은 Coordinator 토큰으로 본다
    assert.equal(workerCallAllowed({ ...rejected, credential: 'worker-token' }), false);
    assert.equal(workerCallAllowed({ ...rejected, job: { status: 'processing' } }), false);
    assert.equal(workerCallAllowed({ ...rejected, credential: undefined }), true);
  });
});

// ── C. 큐 ────────────────────────────────────────────────────
describe('C. 큐 조건', () => {
  const snapshot = (overrides) => {
    const parsed = parseCoordinatorStatus(statusPayload(overrides));
    assert.ok(parsed.ok, JSON.stringify(parsed.problems));
    return parsed.snapshot;
  };
  const target = { requestId: REQUEST_ID, job: knownJob() };

  it('신규 enqueue 사전 검사는 대기 0건만 허용한다', () => {
    assert.equal(evaluateSearchPrecheck(snapshot({ queuePending: 0 }), NOW).ok, true);
    assert.equal(evaluateSearchPrecheck(snapshot({ queuePending: 1 }), NOW).ok, false);
  });

  it('알려진 대상 job 처리: 대기 정확히 1건 + 대상 확인이면 통과', () => {
    assert.equal(evaluateWorkerPrecheck(snapshot({ queuePending: 1 }), NOW, target).ok, true);
  });

  it('대기 0건 · 2건 이상이면 worker 차단 (사유를 구분해 알린다)', () => {
    const zero = evaluateWorkerPrecheck(snapshot({ queuePending: 0 }), NOW, target);
    const two = evaluateWorkerPrecheck(snapshot({ queuePending: 2 }), NOW, target);
    assert.equal(zero.ok, false);
    assert.equal(two.ok, false);
    assert.match(zero.reasons.join(' '), /대기 0건 — 대상 job 이 이미 처리됐거나 없습니다/);
    assert.match(two.reasons.join(' '), /대기 2건 — 대기 중인 것이 대상 job 1건뿐인지/);
  });

  it('처리 중 > 0 이면 차단, 처리 중 값을 모르면(unknown) 차단', () => {
    assert.equal(evaluateWorkerPrecheck(snapshot({ queueProcessing: 1 }), NOW, target).ok, false);
    const unknown = evaluateWorkerPrecheck(snapshot({ queueProcessing: undefined }), NOW, target);
    assert.equal(unknown.ok, false);
    assert.equal(unknown.conditions.find((c) => c.id === 'in-flight').state, 'unknown');
  });

  it('requestId 불일치 · UUID 아님 · 관측 상태 pending 아님 · 근거 없음은 차단', () => {
    const other = randomUUID();
    assert.equal(evaluateWorkerTarget(other, knownJob()).state, 'fail');
    assert.equal(evaluateWorkerTarget('cmpick-1', knownJob({ requestId: 'cmpick-1' })).state, 'fail');
    assert.equal(evaluateWorkerTarget(REQUEST_ID, knownJob({ observed: { status: 'done' } })).state, 'fail');
    assert.equal(evaluateWorkerTarget(REQUEST_ID, knownJob({ observed: null })).state, 'unknown');
    assert.equal(
      evaluateWorkerTarget(REQUEST_ID, knownJob({ observed: null, source: 'admin-run', enqueuedAt: '2026-09-29T11:00:00Z' })).state,
      'pass',
    );
    assert.equal(evaluateWorkerPrecheck(snapshot({}), NOW, { requestId: other, job: knownJob() }).ok, false);
  });

  it('알려진 job 이 아닌 requestId 는 요청 0회', async () => {
    const { result, calls } = await run({ requestId: randomUUID() });
    assert.equal(result.outcome, 'unknown-job');
    assert.equal(totalRequests(calls), 0);
  });

  it('상태가 불명확하면(필드 누락·비객체·401) worker 0회', async () => {
    for (const status of [{ status: 'ok' }, statusPayload({ quota: { rolling60m: '0' } }), null]) {
      const { result, calls } = await run({ central: { status } });
      assert.equal(result.outcome, 'status-unavailable');
      assert.equal(calls.worker, 0);
    }
    const { result, calls } = await run({ env: env({ COUPANG_COORDINATOR_TOKEN: UNKNOWN_TOKEN }) });
    assert.equal(result.outcome, 'status-unavailable');
    assert.equal(calls.worker, 0);
    // HTTP 오류면 본문이 정상 status 모양이어도 쓰지 않는다
    const http = await run({ central: { statusHttp: 503 } });
    assert.equal(http.result.outcome, 'status-unavailable');
    assert.equal(http.calls.worker, 0);
  });

  it('quota · 간격 · 차단 · API 종류 위반이면 worker 0회', async () => {
    for (const overrides of [
      { quota: { rolling60m: 3 } },
      { quota: { rolling24h: 36 } },
      { quota: { normalLimit: 1, rolling60m: 1 } },
      { control: { last_sent_at: new Date(NOW - 20 * 60_000).toISOString() } },
      { control: { blocked_until: new Date(NOW + 60_000).toISOString(), blocked_reason: 'RATE_LIMIT' } },
      { control: { blocked_reason: 'RATE_LIMIT' } },
      { control: { api_type: 'deeplink' } },
      { queueProcessing: 1 },
      { queuePending: 2 },
    ]) {
      const { result, calls } = await run({ central: { status: statusPayload(overrides) } });
      assert.equal(result.outcome, 'precheck-blocked', JSON.stringify(overrides));
      assert.equal(calls.worker, 0);
    }
  });

  it('사전 검사만(check): status 1회, worker 0회', async () => {
    const mock = centralMock();
    const result = await checkWorkerOnce(REQUEST_ID, [knownJob()], { env: env(), fetchImpl: mock.fetchImpl, nowMs: NOW, log: () => {} });
    assert.equal(result.outcome, 'precheck-passed');
    assert.equal(mock.calls.status, 1);
    assert.equal(mock.calls.worker, 0);
  });

  it('production 이 아니거나 live 설정이 없으면 요청 0회', async () => {
    for (const overrides of [
      { NODE_ENV: 'development' },
      { ALLOW_COUPANG_LIVE: 'false' },
      { COUPANG_COORDINATOR_MODE: 'mock' },
      { COUPANG_COORDINATOR_URL: 'http://central-test.invalid/functions/v1/coupang-coordinator' },
      { COUPANG_COORDINATOR_URL: 'https://link.coupang.com/functions/v1/coupang-coordinator' },
      { COUPANG_COORDINATOR_TOKEN: '' },
    ]) {
      const { result, calls } = await run({ env: env(overrides) });
      assert.equal(result.outcome, 'disabled', JSON.stringify(overrides));
      assert.equal(totalRequests(calls), 0);
    }
  });

  it('worker 주소는 Coordinator 와 같은 프로젝트의 coupang-worker-once 만', () => {
    assert.equal(resolveWorkerOnceUrl(env()).url, WORKER_URL);
    assert.equal(resolveWorkerOnceUrl(env({ COUPANG_WORKER_ONCE_URL: 'https://other.invalid/functions/v1/coupang-worker-once' })).url, null);
    assert.equal(resolveWorkerOnceUrl(env({ COUPANG_WORKER_ONCE_URL: 'http://central-test.invalid/x' })).url, null);
    assert.equal(resolveWorkerOnceUrl(env({ COUPANG_COORDINATOR_URL: 'https://central-test.invalid/other' })).url, null);
  });

  it('isCentralRequestId 는 소문자 UUID 만 받는다', () => {
    assert.equal(isCentralRequestId(REQUEST_ID), true);
    assert.equal(isCentralRequestId(REQUEST_ID.toUpperCase()), false);
    assert.equal(isCentralRequestId('cmpick-1'), false);
  });
});

// ── D. 보안 ──────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.next', '.git']);
function collect(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, found);
    else if (/\.(mjs|js|ts|tsx|json|toml|md|example)$/.test(entry) || entry.startsWith('.env')) found.push(full);
  }
  return found;
}
const files = [...collect(join(ROOT, 'src')), ...collect(join(ROOT, 'scripts')), ...collect(join(ROOT, 'docs'))]
  .concat(['netlify.toml', '.env.example', 'next.config.mjs', 'next.config.js'].map((f) => join(ROOT, f)))
  .filter((path) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  })
  .map((path) => ({ path: relative(ROOT, path), code: readFileSync(path, 'utf8') }));

describe('D. 노출 경계', () => {
  it('audit·로그·결과에 토큰·URL 이 없다 (200 · 401 · 차단 모두)', async () => {
    const outputs = [
      await run(),
      await run({ env: env({ [WORKER_TOKEN_ENV]: UNKNOWN_TOKEN }) }),
      await run({ env: env({ [WORKER_TOKEN_ENV]: COORDINATOR_TOKEN }) }),
      await run({ central: { status: statusPayload({ queuePending: 2 }) } }),
    ];
    for (const { result, logs } of outputs) {
      const text = JSON.stringify(result) + logs.join('\n');
      for (const secret of [WORKER_TOKEN, COORDINATOR_TOKEN, UNKNOWN_TOKEN, sha256(WORKER_TOKEN), 'central-test.invalid']) {
        assert.ok(!text.includes(secret), '민감값이 결과/로그에 포함됐다');
      }
    }
    const described = JSON.stringify(describeWorkerCredentialState(env()));
    assert.ok(!described.includes(WORKER_TOKEN));
    assert.equal(describeWorkerCredentialState(env()).state, 'configured');
    assert.equal(describeWorkerCredentialState({}).state, 'missing');
  });

  it('NEXT_PUBLIC_ worker 토큰 이름이 소스·설정·문서 어디에도 없다', () => {
    const hits = files.filter((f) => f.code.includes(`NEXT_PUBLIC_COUPANG_WORKER`) && f.path !== 'scripts/workerOnce.test.mjs');
    assert.deepEqual(hits.map((f) => f.path), []);
  });

  it('worker 토큰 환경변수는 서버 adapter 1곳에서만 읽는다', () => {
    const readers = files.filter(
      (f) => /\.(mjs|js|ts|tsx)$/.test(f.path) && f.code.includes('COUPANG_WORKER_TOKEN') && f.path !== 'scripts/workerOnce.test.mjs',
    );
    assert.deepEqual(readers.map((f) => f.path), ['scripts/coordinator/workerOnce.mjs']);
  });

  it("'use client' 파일은 Coordinator/worker 모듈을 import 하지 않는다", () => {
    const clientFiles = files.filter((f) => /\.(tsx?|jsx?)$/.test(f.path) && /^\s*['"]use client['"]/m.test(f.code));
    assert.ok(clientFiles.length >= 5, `client 파일 ${clientFiles.length}개`);
    for (const file of clientFiles) {
      assert.doesNotMatch(file.code, /coordinator\/(workerOnce|client)\.mjs|workerOnce/, file.path);
    }
  });

  it('adapter 는 중앙 두 함수만 부르고 Coupang host 를 직접 부르지 않는다', () => {
    const code = readFileSync(join(ROOT, 'scripts/coordinator/workerOnce.mjs'), 'utf8');
    assert.ok(!code.includes('api-gateway'));
    assert.doesNotMatch(code, /createHmac|setInterval|setTimeout\(|for\s*\(.*retry|while\s*\(/);
    assert.equal((code.match(/fetchImpl\(/g) ?? []).length, 2, 'status 1곳 + worker 1곳');
    assert.match(code, /\/functions\/v1\/coupang-worker-once/);
  });
});

// ── E. CTA 회귀 ───────────────────────────────────────────────
describe('E. 공개 CTA 불변', () => {
  it('상품 id · coupangUrl 목록이 이 작업 전과 같다', () => {
    const products = JSON.parse(readFileSync(join(ROOT, 'src/data/products.json'), 'utf8'));
    const list = Array.isArray(products) ? products : products.products;
    const fingerprint = createHash('sha256')
      .update(list.map((item) => `${item.id}|${item.coupangUrl}`).join('\n'))
      .digest('hex');
    assert.equal(list.length, 60);
    assert.equal(fingerprint, '5125992fea0b437f7ece4eeaef79aeee3a84306688c85afa8eee7fac27ae0968');
  });

  it('공개 CTA 속성은 그대로다 (target=_blank · rel=noopener noreferrer sponsored · 클릭 가로채기 없음)', () => {
    for (const file of ['src/components/ProductCard.tsx', 'src/components/ProductDetail.tsx']) {
      const code = readFileSync(join(ROOT, file), 'utf8');
      assert.match(code, /href=\{coupangHref\}\s*target="_blank"\s*rel="noopener noreferrer sponsored"/, file);
      assert.doesNotMatch(code, /window\.location|window\.open|intent:\/\/|router\.push\(\s*(product\.coupangUrl|coupangHref)/, file);
    }
  });
});
