/**
 * Coupang API Coordinator 클라이언트.
 *
 * 센치픽·차종픽·꿀템픽은 하나의 쿠팡 파트너스 계정을 함께 쓴다.
 * 각 사이트가 스스로 Search API 를 부르면 세 배로 부르게 되고, 시간당
 * 한도를 넘겨 계정이 막힌다. 그래서 이 저장소는 쿠팡을 직접 부르지
 * 않는다. 공용 Coordinator 에 요청만 넣고, 실제 호출 권한과 quota,
 * HMAC 서명, circuit breaker 는 전부 Coordinator 가 가진다.
 *
 * 자세한 정책은 docs/coupang-api-policy.md 를 본다.
 *
 * Foundation 단계에서는 Coordinator 가 아직 없다. 그래서 mock 구현만
 * 동작하고 live 경로는 어떤 설정을 줘도 막혀 있다 (fail-closed).
 */
import { createHash } from 'node:crypto';
import { MOCK_CATALOG } from './mockCatalog.mjs';

/** Coordinator 가 아직 없으므로 live 경로는 구현되어 있지 않다. */
export const FOUNDATION_PHASE = true;

export const COORDINATOR_MODES = ['mock', 'live'];

/** 이 저장소를 가리키는 프로젝트 이름. Coordinator 가 공정성 계산에 쓴다. */
export const PROJECT = 'cmpick';

export class LiveModeBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LiveModeBlockedError';
    this.code = 'LIVE_BLOCKED';
  }
}

export class CoordinatorUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CoordinatorUnavailableError';
    this.code = 'COORDINATOR_UNAVAILABLE';
  }
}

export class MockInProductionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MockInProductionError';
    this.code = 'MOCK_IN_PRODUCTION';
  }
}

/**
 * 설정을 읽어 동작 모드를 정한다.
 *
 * 기본값은 언제나 mock 이고 live 는 거짓이다. live 로 가려면 모드와
 * 허용 플래그를 둘 다 명시해야 한다. 둘 중 하나라도 없으면 mock 이다.
 * 애매한 설정을 live 로 해석하지 않는다.
 */
export function resolveMode(env = process.env) {
  const requested = env.COUPANG_COORDINATOR_MODE ?? 'mock';
  const allowLive = env.ALLOW_COUPANG_LIVE === 'true';
  const wantsLive = requested === 'live';

  return {
    requested,
    allowLive,
    // 명시적 허용이 없으면 live 로 올라가지 않는다
    live: wantsLive && allowLive,
    mode: wantsLive && allowLive ? 'live' : 'mock',
  };
}

/** 같은 키워드를 두 번 부르지 않도록 Coordinator 가 쓰는 캐시 키. */
export function keywordHash(keyword, category = '') {
  return createHash('sha256')
    .update(`${String(keyword).trim().toLowerCase()}::${category}`)
    .digest('hex')
    .slice(0, 16);
}

function assertNotProduction(env) {
  if (env.NODE_ENV === 'production' && env.ALLOW_MOCK_PRODUCTS !== 'true') {
    throw new MockInProductionError(
      'mock 상품은 개발·테스트 전용입니다. 운영 환경에 mock 을 노출하지 않습니다.',
    );
  }
}

/**
 * Foundation 단계의 가짜 Coordinator.
 * 네트워크를 쓰지 않고 준비된 목록에서 돌려준다.
 */
function mockTransport({ keyword, category }) {
  const hash = keywordHash(keyword, category);
  const matched = MOCK_CATALOG.filter(
    (item) => !category || item.category === category,
  ).slice(0, 10);

  return {
    // 실제로는 Coordinator 가 cached / queued / mock 중 하나를 준다
    status: 'mock',
    keywordHash: hash,
    products: matched.map((item) => ({ ...item, source: 'mock', isMock: true })),
    quota: { actualApiCalled: false },
  };
}

/**
 * Coordinator 클라이언트를 만든다.
 *
 * transport 를 넘기면 그것을 쓴다 (테스트에서 Coordinator 장애를 흉내낼 때).
 * 넘기지 않으면 mock 구현이 붙는다.
 */
export function createCoordinatorClient({
  project = PROJECT,
  env = process.env,
  transport,
} = {}) {
  const resolved = resolveMode(env);

  return {
    project,
    mode: resolved.mode,

    /**
     * 키워드 하나에 대한 상품 목록을 Coordinator 에 요청한다.
     * 이 저장소는 여기서 쿠팡을 직접 부르지 않는다.
     */
    async searchProducts({ keyword, category = '', requestId } = {}) {
      if (typeof keyword !== 'string' || keyword.trim() === '') {
        throw new TypeError('keyword 는 비어 있지 않은 문자열이어야 합니다.');
      }

      if (resolved.live || FOUNDATION_PHASE === false) {
        // Coordinator 가 준비되기 전에는 live 경로 자체가 없다.
        throw new LiveModeBlockedError(
          'Coordinator live 모드는 아직 구현되지 않았습니다. ' +
            '이 저장소는 쿠팡 API 를 직접 부르지 않습니다 (docs/coupang-api-policy.md).',
        );
      }

      assertNotProduction(env);

      const call = transport ?? mockTransport;
      let result;
      try {
        result = await call({ project, keyword, category, requestId });
      } catch (error) {
        // Coordinator 상태를 모르면 요청하지 않는다. 직접 호출로 우회하지 않는다.
        throw new CoordinatorUnavailableError(
          `Coordinator 에 물어볼 수 없습니다: ${error.message}. ` +
            '쿠팡 API 를 직접 부르지 않고 그대로 멈춥니다.',
        );
      }

      if (!result || typeof result !== 'object') {
        throw new CoordinatorUnavailableError('Coordinator 응답을 해석할 수 없습니다.');
      }
      if (result.quota?.actualApiCalled) {
        // 이 단계에서 실제 호출이 일어났다면 설계가 깨진 것이다.
        throw new LiveModeBlockedError(
          'Foundation 단계에서 실제 쿠팡 API 가 호출됐다고 보고됐습니다.',
        );
      }

      return {
        status: result.status ?? 'mock',
        products: result.products ?? [],
        quota: { actualApiCalled: false, ...result.quota, actualApiCalled: false },
      };
    },

    /**
     * 키워드를 Coordinator 큐에 넣는다. 실제 호출 시점은 Coordinator 가 정한다.
     * Foundation 단계에서는 보낼 곳이 없으므로 보낼 내용만 만들어 돌려준다.
     */
    buildQueueJob({ keyword, category = '', priority = 0 } = {}) {
      return {
        project,
        keyword,
        category,
        keywordHash: keywordHash(keyword, category),
        priority,
        status: 'pending',
      };
    },
  };
}
