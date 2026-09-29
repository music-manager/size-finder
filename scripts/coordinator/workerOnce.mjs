/**
 * 중앙 `coupang-worker-once` 호출 adapter (서버 전용).
 *
 * 기준 구현: music-manager/vehicle-fit-finder `src/lib/admin/worker-once.ts`
 * (production 에서 worker HTTP 200 · actualApiCalled=true · cache 10건 저장까지 확인된 구조).
 *
 * 중앙 worker 의 안전장치(인증·allowedProjects·claim by requestId·quota/interval/breaker)를
 * **복제하지 않는다.** 여기서는
 * - worker 호출 직전에 중앙 status 를 다시 읽어 보수적으로 사전 검사하고
 * - 이미 알려진 pending job 의 requestId 로 **정확히 1회** 부르며
 * - 응답을 화이트리스트로만 읽는다.
 *
 * 인증:
 * - status 는 기존 `COUPANG_COORDINATOR_TOKEN`
 * - worker-once(action=process_one) 는 **worker 전용 `COUPANG_WORKER_TOKEN`**
 *   (중앙 client: allowedActions=['process_one'], allowedProjects=['cmpick'])
 *   Coordinator 토큰으로 대신하지 않는다. 차종픽 production 에서 그 조합은 HTTP 401 이었다.
 * - 토큰은 런타임 서버 환경변수에서만 읽고, 결과·로그·화면에 값·길이·hash 를 넣지 않는다.
 *
 * 재시도 0회. 실패·차단도 결과로 남기고 끝낸다.
 * 이 파일은 Coupang 에 직접 요청하지 않는다. 요청 대상은 중앙 Coordinator 의 두 함수뿐이다.
 */
import { PROJECT as COORDINATOR_PROJECT, resolveMode } from './client.mjs';

/**
 * 중앙 worker client 의 allowedProjects 와 queue 행 project 에 쓰는 센치픽 식별자.
 * production 중앙 DB(coupang_api_queue.project, 기존 client cmpick-netlify)는 `cmpick` 이다.
 * 기존 Coordinator client(client.mjs PROJECT)와 **같은 값**이어야 worker 가 job 을 claim 한다.
 */
export const WORKER_PROJECT_ID = COORDINATOR_PROJECT;
export const WORKER_ONCE_ACTION = 'process_one';
export const WORKER_TOKEN_ENV = 'COUPANG_WORKER_TOKEN';
const COORDINATOR_TOKEN_ENV = 'COUPANG_COORDINATOR_TOKEN';
const PUBLIC_WORKER_TOKEN_ENV = `NEXT_PUBLIC_${WORKER_TOKEN_ENV}`;
const COORDINATOR_FUNCTION_PATH = '/functions/v1/coupang-coordinator';
const WORKER_ONCE_FUNCTION_PATH = '/functions/v1/coupang-worker-once';

/** 지금 worker-once 호출에 쓰는 자격증명 종류 (값·hash 는 남기지 않는다) */
export const CURRENT_WORKER_CREDENTIAL = 'worker-token';

/**
 * 공용 quota 정책 (docs/coupang-api-policy.md). 세 프로젝트 합산이며 중앙이 집행한다.
 * 여기서는 중앙 status 값과 비교해 **더 엄격한 쪽**만 쓴다. 호출 허가 권한은 없다.
 */
export const SHARED_QUOTA_POLICY = Object.freeze({
  normalLimitPerRollingHour: 3,
  hardLimitPerRollingHour: 4,
  dailyLimitPerRollingDay: 36,
  minIntervalMinutes: 21,
});

export const SEARCH_API_TYPE = 'search';

// ── 자격증명 · 주소 ──────────────────────────────────────────

/**
 * 중앙 Coordinator live 설정. 하나라도 없으면 null (호출하지 않는다).
 * client.mjs 의 live 판정(모드 live + ALLOW_COUPANG_LIVE=true)과 URL/토큰 규칙을 그대로 따른다.
 */
export function readCoordinatorLive(env = process.env) {
  if (!resolveMode(env).live) return { url: null, token: null, reason: 'Coordinator live 모드가 아닙니다.' };
  const url = String(env.COUPANG_COORDINATOR_URL ?? '').trim();
  const token = String(env[COORDINATOR_TOKEN_ENV] ?? '').trim();
  if (!url || !token) {
    return { url: null, token: null, reason: 'Coordinator URL 또는 토큰이 설정되지 않았습니다.' };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { url: null, token: null, reason: 'Coordinator URL 을 해석할 수 없습니다.' };
  }
  if (parsed.protocol !== 'https:') return { url: null, token: null, reason: 'Coordinator URL 은 https 여야 합니다.' };
  const host = parsed.hostname.toLowerCase();
  if (host === 'coupang.com' || host.endsWith('.coupang.com')) {
    return { url: null, token: null, reason: 'Coordinator URL 에 Coupang host 를 쓸 수 없습니다.' };
  }
  return { url: parsed.toString(), token, reason: null };
}

/**
 * worker-once 호출용 server-only 토큰.
 * - `COUPANG_WORKER_TOKEN` 이 없거나 비어 있으면 null (Coordinator 토큰으로 대신하지 않는다)
 * - Coordinator 토큰과 같으면 null
 * - 같은 이름에 `NEXT_PUBLIC_` 을 붙인 변수가 있으면 null — 브라우저 번들로 새는 이름을 쓰지 않는다
 * 값·길이·hash 는 결과에 넣지 않는다.
 */
export function resolveWorkerCredential(env = process.env) {
  if (env[PUBLIC_WORKER_TOKEN_ENV] !== undefined) {
    return {
      token: null,
      state: 'public-name',
      reason: `${PUBLIC_WORKER_TOKEN_ENV} 는 쓰지 않습니다. 지우고 ${WORKER_TOKEN_ENV} 로만 설정하세요.`,
    };
  }
  const token = String(env[WORKER_TOKEN_ENV] ?? '').trim() || null;
  if (token === null) {
    return { token: null, state: 'missing', reason: `${WORKER_TOKEN_ENV} 가 설정되지 않았습니다.` };
  }
  const coordinatorToken = String(env[COORDINATOR_TOKEN_ENV] ?? '').trim() || null;
  if (coordinatorToken !== null && token === coordinatorToken) {
    return {
      token: null,
      state: 'same-as-coordinator',
      reason: `${WORKER_TOKEN_ENV} 가 Coordinator 토큰과 같습니다. worker 전용 client 의 토큰을 따로 설정하세요.`,
    };
  }
  return { token, state: 'configured', reason: null };
}

/** Admin 화면용: 설정 상태만 (값·길이·hash 없음) */
export function describeWorkerCredentialState(env = process.env) {
  const { state, reason } = resolveWorkerCredential(env);
  return { state, reason };
}

/**
 * worker-once 주소.
 * - `COUPANG_WORKER_ONCE_URL` 이 있으면 그 값(https + Coordinator 와 같은 origin 일 때만)
 * - 없으면 Coordinator URL 이 `/functions/v1/coupang-coordinator` 일 때 같은 프로젝트의
 *   `/functions/v1/coupang-worker-once`
 * 어느 쪽도 아니면 null (호출하지 않는다).
 */
export function resolveWorkerOnceUrl(env = process.env) {
  const live = readCoordinatorLive(env);
  if (live.url === null) return { url: null, reason: live.reason };
  const coordinator = new URL(live.url);

  const override = String(env.COUPANG_WORKER_ONCE_URL ?? '').trim();
  if (override) {
    let parsed;
    try {
      parsed = new URL(override);
    } catch {
      return { url: null, reason: 'worker-once URL 을 해석할 수 없습니다.' };
    }
    if (parsed.protocol !== 'https:') return { url: null, reason: 'worker-once URL 은 https 여야 합니다.' };
    if (parsed.origin !== coordinator.origin) {
      return { url: null, reason: 'worker-once URL 이 Coordinator 와 같은 프로젝트가 아닙니다.' };
    }
    return { url: parsed.toString(), reason: null };
  }

  if (coordinator.pathname.replace(/\/$/, '') !== COORDINATOR_FUNCTION_PATH || coordinator.search !== '') {
    return { url: null, reason: 'Coordinator URL 형식에서 worker-once 주소를 정할 수 없습니다.' };
  }
  return { url: `${coordinator.origin}${WORKER_ONCE_FUNCTION_PATH}`, reason: null };
}

/** 실행 가능 여부. production 빌드 + Coordinator live 설정이 모두 있어야 열린다. */
export function readWorkerGate(env = process.env) {
  const reasons = [];
  if (env.NODE_ENV !== 'production') reasons.push('production 빌드가 아닙니다.');
  const live = readCoordinatorLive(env);
  if (live.url === null) reasons.push(live.reason);
  return { enabled: reasons.length === 0, reasons };
}

// ── requestId · job ─────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** 중앙 request_id 형식(소문자 UUID)인지 */
export function isCentralRequestId(value) {
  return typeof value === 'string' && UUID.test(value);
}

// ── 재호출 판정 (worker-retry) ───────────────────────────────

/** 기록의 자격증명. 필드가 없는 기록은 Coordinator 토큰으로 부른 것으로 본다(보수적). */
export function credentialOf(worker) {
  return worker.credential ?? 'coordinator-token';
}

/** 중앙 worker client 인증 거부였고 job 이 claim 되지 않았다고 볼 수 있는 기록인지 */
export function isAuthRejected(worker) {
  return (
    worker.outcome === 'http-error' &&
    worker.httpStatus === 401 &&
    worker.actualApiCalled !== true &&
    (worker.job === null || worker.job.status === 'pending')
  );
}

/**
 * 이 job 에 worker 를 (다시) 부를 수 있는지.
 * 한 번 불렀으면 다시 부르지 않는다. 예외는 **다른 자격증명**으로 인증 거부(401)됐고
 * actualApiCalled 가 true 가 아니며 job 이 pending/없음인 기록 하나뿐이다(운영자가 다시 누를 때만).
 */
export function workerCallAllowed(worker, credential = CURRENT_WORKER_CREDENTIAL) {
  if (worker === null || worker === undefined) return true;
  return isAuthRejected(worker) && credentialOf(worker) !== credential;
}

// ── status 계약 파싱 ─────────────────────────────────────────

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const SAFE_LABEL = /^[A-Za-z0-9_.:-]{1,48}$/;

/** 값의 종류만 말한다. 값 자체는 담지 않는다. */
export function kindOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'string') return ISO_DATETIME.test(value) ? 'string:datetime' : 'string';
  return typeof value;
}

function safeLabel(value) {
  return typeof value === 'string' && SAFE_LABEL.test(value) ? value : `(${kindOf(value)})`;
}

function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readCount(owner, path, key, problems) {
  const value = owner?.[key];
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  problems.push(`${path ? `${path}.` : ''}${key} 가 없거나 0 이상의 정수가 아닙니다.`);
  return -1;
}

function readNullableTime(owner, path, key, problems) {
  if (owner === null || !(key in owner)) {
    problems.push(`${path}.${key} 가 없습니다.`);
    return null;
  }
  const value = owner[key];
  if (value === null) return null;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  problems.push(`${path}.${key} 를 시각으로 해석할 수 없습니다.`);
  return null;
}

/**
 * Coordinator `status` 응답을 계약대로 읽는다(차종픽 docs/coupang-coordinator-status-contract.md).
 * 필드가 하나라도 없거나 형식이 다르면 실패다(fail-closed). 기본값으로 채우지 않는다.
 */
export function parseCoordinatorStatus(payload) {
  const root = asObject(payload);
  if (root === null) return { ok: false, problems: ['status 응답이 객체가 아닙니다.'] };

  const problems = [];
  if (root.status !== 'ok') problems.push(`status 가 ok 가 아닙니다(${safeLabel(root.status)}).`);
  if (root.actualApiCalled !== false) problems.push('actualApiCalled=false 가 보장되지 않았습니다.');

  const control = asObject(root.control);
  if (control === null) problems.push('control 이 없습니다.');
  const quota = asObject(root.quota);
  if (quota === null) problems.push('quota 가 없습니다.');

  let apiType = '';
  if (control !== null) {
    if (typeof control.api_type === 'string' && control.api_type.length > 0) apiType = control.api_type;
    else problems.push('control.api_type 이 문자열이 아닙니다.');
  }
  const blockedUntilMs = readNullableTime(control, 'control', 'blocked_until', problems);
  let blockedReasonPresent = false;
  if (control !== null) {
    if (!('blocked_reason' in control)) problems.push('control.blocked_reason 가 없습니다.');
    else if (control.blocked_reason !== null && typeof control.blocked_reason !== 'string') {
      problems.push('control.blocked_reason 이 null 또는 문자열이 아닙니다.');
    } else blockedReasonPresent = control.blocked_reason !== null;
  }
  const before = problems.length;
  const lastSent = readNullableTime(control, 'control', 'last_sent_at', problems);
  if (lastSent === null && problems.length === before) {
    problems.push('control.last_sent_at 가 null 입니다(시각을 확인할 수 없음).');
  }

  const rolling60m = readCount(quota, 'quota', 'rolling60m', problems);
  const rolling24h = readCount(quota, 'quota', 'rolling24h', problems);
  const normalLimit = readCount(quota, 'quota', 'normalLimit', problems);
  const hardLimit = readCount(quota, 'quota', 'hardLimit', problems);
  const dailyLimit = readCount(quota, 'quota', 'dailyLimit', problems);
  const minIntervalMinutes = readCount(quota, 'quota', 'minIntervalMinutes', problems);
  const queuePending = readCount(root, '', 'queuePending', problems);
  const rawProcessing = root.queueProcessing;
  const queueProcessing =
    typeof rawProcessing === 'number' && Number.isInteger(rawProcessing) && rawProcessing >= 0 ? rawProcessing : null;

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    snapshot: {
      apiType,
      blockedUntilMs,
      blockedReasonPresent,
      lastSentAtMs: lastSent,
      rolling60m,
      rolling24h,
      normalLimit,
      hardLimit,
      dailyLimit,
      minIntervalMinutes,
      queuePending,
      queueProcessing,
      queueProcessingKind: 'queueProcessing' in root ? kindOf(rawProcessing) : '키 없음',
    },
  };
}

// ── 사전 검사 ────────────────────────────────────────────────

/** 이 repo 정책과 중앙 반환값 중 **더 엄격한** 한도 */
export function effectiveLimits(snapshot) {
  const policy = SHARED_QUOTA_POLICY;
  return {
    rolling60: Math.min(policy.normalLimitPerRollingHour, snapshot.normalLimit, snapshot.hardLimit),
    rolling24: Math.min(policy.dailyLimitPerRollingDay, snapshot.dailyLimit),
    intervalMinutes: Math.max(policy.minIntervalMinutes, snapshot.minIntervalMinutes),
  };
}

export const AUTHORIZATION_BASIS =
  '중앙이 토큰의 client 와 allowedProjects 로 강제 (worker: process_one + cmpick)';

/**
 * 신규 enqueue 사전 검사 (대기 0건 필수). 모든 조건이 pass 여야 한다. unknown 은 fail 과 같다.
 */
export function evaluateSearchPrecheck(snapshot, nowMs) {
  const limits = effectiveLimits(snapshot);
  const conditions = [];
  const add = (id, state, detail) => conditions.push({ id, state, detail });

  add(
    'api-type',
    snapshot.apiType === SEARCH_API_TYPE ? 'pass' : 'fail',
    snapshot.apiType === SEARCH_API_TYPE
      ? 'control 행이 search API 를 가리킵니다.'
      : `control.api_type 이 ${SEARCH_API_TYPE} 가 아닙니다(${safeLabel(snapshot.apiType)}).`,
  );

  if (snapshot.blockedUntilMs !== null && snapshot.blockedUntilMs > nowMs) {
    add('blocked', 'fail', 'circuit breaker 차단 중입니다.');
  } else if (snapshot.blockedUntilMs === null && snapshot.blockedReasonPresent) {
    add('blocked', 'fail', '차단 사유가 있는데 해제 시각이 없습니다(무기한 차단일 수 있어 보내지 않음).');
  } else {
    add('blocked', 'pass', '차단 상태가 아닙니다.');
  }

  add(
    'rolling60',
    snapshot.rolling60m < limits.rolling60 ? 'pass' : 'fail',
    `rolling 60분 ${snapshot.rolling60m}회 / 한도 ${limits.rolling60}회`,
  );
  add(
    'rolling24',
    snapshot.rolling24h < limits.rolling24 ? 'pass' : 'fail',
    `rolling 24시간 ${snapshot.rolling24h}회 / 한도 ${limits.rolling24}회`,
  );

  const elapsed = nowMs - snapshot.lastSentAtMs;
  const intervalMs = limits.intervalMinutes * 60_000;
  if (elapsed < 0) add('interval', 'fail', 'last_sent_at 이 현재 시각보다 미래입니다(시각 불일치).');
  else if (elapsed < intervalMs) {
    add('interval', 'fail', `마지막 실제 호출 후 ${limits.intervalMinutes}분이 지나지 않았습니다.`);
  } else add('interval', 'pass', `마지막 실제 호출 후 ${limits.intervalMinutes}분 이상 지났습니다.`);

  add('queue-pending', snapshot.queuePending === 0 ? 'pass' : 'fail', `중앙 큐 대기 ${snapshot.queuePending}건.`);

  if (snapshot.queueProcessing === null) {
    add('in-flight', 'unknown', `queueProcessing 을 확인할 수 없습니다(실제: ${snapshot.queueProcessingKind}).`);
  } else {
    add('in-flight', snapshot.queueProcessing === 0 ? 'pass' : 'fail', `중앙 처리 중 큐 ${snapshot.queueProcessing}건.`);
  }

  add('authorization', 'pass', AUTHORIZATION_BASIS);

  const reasons = conditions.filter((item) => item.state !== 'pass').map((item) => item.detail);
  return { ok: reasons.length === 0, reasons, conditions };
}

/**
 * 대상 job 판정. 중앙 status 는 대기 **개수**만 주므로, 아래가 모두 맞을 때만 인정한다.
 * - requestId 가 중앙 형식(UUID)이고 알려진 job 의 requestId 와 정확히 같다
 * - 이 requestId 로 worker 를 부른 적이 없다(다른 자격증명 401 예외만 허용)
 * - 마지막으로 알려진 상태가 pending 이다(관측값 pending, 또는 관측값 없이 enqueue 응답에서 받은 requestId)
 */
export function evaluateWorkerTarget(requestId, job) {
  const at = (state, detail) => ({ id: 'target-job', state, detail });
  if (!isCentralRequestId(requestId)) return at('fail', '대상 requestId 가 중앙 형식(UUID)이 아닙니다.');
  if (!job || job.requestId !== requestId) return at('fail', '대상 requestId 가 알려진 job 과 일치하지 않습니다.');
  if (!workerCallAllowed(job.worker ?? null, CURRENT_WORKER_CREDENTIAL)) {
    return at('fail', '이 requestId 로 이미 worker 를 부른 기록이 있습니다.');
  }
  if (job.observed) {
    return job.observed.status === 'pending'
      ? at('pass', '대상 job 이 pending 으로 관측됐고 worker 를 부른 적이 없습니다.')
      : at('fail', `대상 job 의 마지막 관측 상태가 pending 이 아닙니다(${safeLabel(job.observed.status)}).`);
  }
  if (job.source === 'admin-run' && typeof job.enqueuedAt === 'string') {
    return at('pass', '이 Admin 이 enqueue 응답에서 받은 requestId 이고 worker 를 부른 적이 없습니다.');
  }
  return at('unknown', '대상 job 이 pending 인지 확인할 근거가 없습니다.');
}

/**
 * worker 호출 직전 사전 검사. 신규 enqueue 사전 검사(대기 0건)는 바꾸지 않고,
 * 알려진 job 을 처리하는 이 경로에서만 대기 **정확히 1건 = 대상 job** 일 때 통과한다.
 */
export function evaluateWorkerPrecheck(snapshot, nowMs, target) {
  const targetCondition = evaluateWorkerTarget(target.requestId, target.job);
  const base = evaluateSearchPrecheck(snapshot, nowMs);
  let queueCondition;
  if (snapshot.queuePending === 0) {
    queueCondition = { id: 'queue-pending', state: 'fail', detail: '중앙 큐 대기 0건 — 대상 job 이 이미 처리됐거나 없습니다.' };
  } else if (snapshot.queuePending !== 1) {
    queueCondition = {
      id: 'queue-pending',
      state: 'fail',
      detail: `중앙 큐 대기 ${snapshot.queuePending}건 — 대기 중인 것이 대상 job 1건뿐인지 확인할 수 없습니다.`,
    };
  } else if (targetCondition.state !== 'pass') {
    queueCondition = {
      id: 'queue-pending',
      state: 'unknown',
      detail: '중앙 큐 대기 1건 — 그 1건이 대상 job 인지 확인할 수 없습니다.',
    };
  } else {
    queueCondition = { id: 'queue-pending', state: 'pass', detail: '중앙 큐 대기 1건이고 대상 job 이 pending 으로 확인됐습니다.' };
  }
  const conditions = base.conditions
    .map((condition) => (condition.id === 'queue-pending' ? queueCondition : condition))
    .concat(targetCondition);
  const reasons = conditions.filter((item) => item.state !== 'pass').map((item) => item.detail);
  return { ok: reasons.length === 0, reasons, conditions };
}

// ── 응답 ────────────────────────────────────────────────────

function label(value) {
  return typeof value === 'string' && SAFE_LABEL.test(value) ? value : null;
}

function datetime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function readJob(value) {
  const row = asObject(value);
  if (row === null) return null;
  return {
    status: label(row.status),
    attempts: Number.isInteger(row.attempts) && row.attempts >= 0 ? row.attempts : null,
    createdAt: datetime(row.created_at),
    startedAt: datetime(row.started_at),
    finishedAt: datetime(row.finished_at),
    lastError: typeof row.last_error === 'string' ? row.last_error.slice(0, 200) : null,
  };
}

/** worker-once 응답을 화이트리스트로만 읽는다. 모르는 값은 null(확인 불가). */
export function parseWorkerResponse(httpStatus, payload, at, credential) {
  const row = asObject(payload);
  if (row === null) {
    return {
      at,
      outcome: 'invalid-response',
      httpStatus,
      status: null,
      actualApiCalled: null,
      error: `응답이 객체가 아닙니다(${kindOf(payload)})`,
      job: null,
      credential,
    };
  }
  return {
    at,
    outcome: httpStatus >= 200 && httpStatus < 300 ? 'responded' : 'http-error',
    httpStatus,
    status: label(row.status),
    actualApiCalled: typeof row.actualApiCalled === 'boolean' ? row.actualApiCalled : null,
    error: label(row.error) ?? label(row.reason),
    job: readJob(row.job),
    credential,
  };
}

// ── 실행 ────────────────────────────────────────────────────

async function fetchStatus(url, token, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'status', project: COORDINATOR_PROJECT }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'Coordinator status 연결에 실패했습니다.' };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: `Coordinator status 응답이 JSON 이 아닙니다(HTTP ${response.status}).` };
  }
  if (!response.ok) return { ok: false, reason: `Coordinator status 요청이 거부됐습니다(HTTP ${response.status}).` };
  return { ok: true, payload };
}

/**
 * 이미 알려진 job 1건에 대해 worker-once 를 정확히 1회 부른다.
 * @param {string} requestId 대상 중앙 request_id. knownJobs 에 있는 값과 정확히 같아야 한다.
 * @param {ReadonlyArray<object>} knownJobs 알려진 job 기록. 여기에 없으면 부르지 않는다.
 */
export function runWorkerOnce(requestId, knownJobs, options = {}) {
  return workerOnce(requestId, knownJobs, options, 'run');
}

/** worker 사전 검사만 한다. status 1회만 읽고 worker 는 부르지 않는다. */
export function checkWorkerOnce(requestId, knownJobs, options = {}) {
  return workerOnce(requestId, knownJobs, options, 'check');
}

async function workerOnce(requestId, knownJobs, options, mode) {
  const env = options.env ?? process.env;
  const nowMs = options.nowMs ?? Date.now();
  const log = options.log ?? ((line) => console.info(line));
  const counts = { status: 0, worker: 0 };
  const job = isCentralRequestId(requestId) ? (knownJobs.find((item) => item.requestId === requestId) ?? null) : null;

  const audit = {
    event: 'coupang-worker-once',
    project: WORKER_PROJECT_ID,
    mode,
    at: new Date(nowMs).toISOString(),
    requestId: job?.requestId ?? null,
    coordinatorRequests: counts,
    precheck: null,
    worker: null,
    outcome: 'disabled',
    message: '',
  };
  const finish = (ok, outcome, message) => {
    audit.outcome = outcome;
    audit.message = message;
    log(JSON.stringify(audit));
    return { ok, outcome, message, audit };
  };

  const gate = readWorkerGate(env);
  if (!gate.enabled) return finish(false, 'disabled', `실행 환경이 닫혀 있어 worker 를 부르지 않았습니다: ${gate.reasons.join(' ')}`);
  if (job === null) return finish(false, 'unknown-job', '알려진 job 의 requestId 가 아니어서 worker 를 부르지 않았습니다.');
  if (!workerCallAllowed(job.worker ?? null, CURRENT_WORKER_CREDENTIAL)) {
    return finish(
      false,
      'already-called',
      job.worker && isAuthRejected(job.worker)
        ? '이 requestId 는 같은 worker 자격증명으로 이미 인증 거부(401)됐습니다. 자격증명을 바꾸기 전에는 다시 부르지 않습니다.'
        : '이 requestId 로 이미 worker 를 한 번 불렀습니다. 자동·반복 호출하지 않습니다.',
    );
  }
  const target = resolveWorkerOnceUrl(env);
  if (target.url === null) return finish(false, 'disabled', `worker-once 주소를 정할 수 없어 부르지 않았습니다: ${target.reason}`);
  const credential = resolveWorkerCredential(env);
  if (credential.token === null) return finish(false, 'disabled', `worker 전용 토큰이 없어 부르지 않았습니다: ${credential.reason}`);

  const live = readCoordinatorLive(env);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  // 1) worker 직전 status 재확인 (Coordinator 토큰)
  counts.status += 1;
  const status = await fetchStatus(live.url, live.token, fetchImpl);
  if (!status.ok) {
    audit.precheck = { ok: false, reasons: [status.reason], conditions: [], snapshot: null };
    return finish(false, 'status-unavailable', `상태 확인 실패로 worker 를 부르지 않았습니다: ${status.reason}`);
  }
  const parsed = parseCoordinatorStatus(status.payload);
  if (!parsed.ok) {
    audit.precheck = { ok: false, reasons: parsed.problems, conditions: [], snapshot: null };
    return finish(false, 'status-unavailable', `상태 계약 필드를 확인하지 못해 worker 를 부르지 않았습니다: ${parsed.problems.join(' ')}`);
  }
  const precheck = evaluateWorkerPrecheck(parsed.snapshot, nowMs, { requestId, job });
  audit.precheck = { ...precheck, snapshot: parsed.snapshot };
  if (!precheck.ok) return finish(false, 'precheck-blocked', `사전 검사에서 막혀 worker 를 부르지 않았습니다: ${precheck.reasons.join(' ')}`);
  if (mode === 'check') {
    return finish(true, 'precheck-passed', 'worker 사전 검사 통과(대기 1건 = 대상 job). worker 는 부르지 않았습니다.');
  }

  // 2) worker-once — worker 전용 토큰, 정확히 1회, 재시도 없음
  counts.worker += 1;
  const at = new Date(nowMs).toISOString();
  let response;
  try {
    response = await fetchImpl(target.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${credential.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ action: WORKER_ONCE_ACTION, project: WORKER_PROJECT_ID, requestId: job.requestId }),
      cache: 'no-store',
    });
  } catch {
    audit.worker = {
      at,
      outcome: 'network-error',
      httpStatus: null,
      status: null,
      actualApiCalled: null,
      error: 'network',
      job: null,
      credential: CURRENT_WORKER_CREDENTIAL,
    };
    return finish(false, 'worker-called', 'worker-once 연결 결과를 확인하지 못했습니다(재시도하지 않음).');
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    audit.worker = {
      at,
      outcome: 'invalid-response',
      httpStatus: response.status,
      status: null,
      actualApiCalled: null,
      error: 'non-json',
      job: null,
      credential: CURRENT_WORKER_CREDENTIAL,
    };
    return finish(false, 'worker-called', `worker-once 응답이 JSON 이 아닙니다(HTTP ${response.status}, 재시도하지 않음).`);
  }
  audit.worker = parseWorkerResponse(response.status, payload, at, CURRENT_WORKER_CREDENTIAL);
  const ok = audit.worker.outcome === 'responded';
  return finish(
    ok,
    'worker-called',
    ok
      ? `worker-once 응답 수신 (HTTP ${response.status}). 결과는 응답 필드와 중앙 상태로 확인합니다.`
      : `worker-once 가 HTTP ${response.status} 로 응답했습니다(재시도하지 않음).`,
  );
}
