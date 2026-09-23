/**
 * Coupang API Coordinator client.
 *
 * This repo never calls Coupang Search API directly. In live mode it only talks
 * to the shared Coordinator, which owns quota, queue, cache, circuit breaker
 * and Coupang credentials.
 */
import { createHash } from 'node:crypto';
import { MOCK_CATALOG } from './mockCatalog.mjs';

export const FOUNDATION_PHASE = false;
export const COORDINATOR_MODES = ['mock', 'live'];
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

export function resolveMode(env = process.env) {
  const requested = env.COUPANG_COORDINATOR_MODE ?? 'mock';
  const allowLive = env.ALLOW_COUPANG_LIVE === 'true';
  const wantsLive = requested === 'live';
  return {
    requested,
    allowLive,
    live: wantsLive && allowLive,
    mode: wantsLive && allowLive ? 'live' : 'mock',
  };
}

export function keywordHash(keyword, category = '') {
  return createHash('sha256')
    .update(`${String(keyword).trim().toLowerCase()}::${category}`)
    .digest('hex')
    .slice(0, 16);
}

function assertNotProduction(env) {
  if (env.NODE_ENV === 'production' && env.ALLOW_MOCK_PRODUCTS !== 'true') {
    throw new MockInProductionError(
      'mock products are development/test only and are blocked in production.',
    );
  }
}

function mockTransport({ keyword, category }) {
  const matched = MOCK_CATALOG.filter(
    (item) => !category || item.category === category,
  ).slice(0, 10);
  return {
    status: 'mock',
    keywordHash: keywordHash(keyword, category),
    products: matched.map((item) => ({ ...item, source: 'mock', isMock: true })),
    actualApiCalled: false,
  };
}

function liveConfig(env) {
  const url = String(env.COUPANG_COORDINATOR_URL ?? '').trim();
  const token = String(env.COUPANG_COORDINATOR_TOKEN ?? '').trim();
  if (!url || !token) {
    throw new LiveModeBlockedError(
      'Coordinator live mode is blocked until URL and site token are both configured.',
    );
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new CoordinatorUnavailableError('COUPANG_COORDINATOR_URL is invalid.');
  }
  if (parsed.protocol !== 'https:') {
    throw new CoordinatorUnavailableError('Coordinator URL must use HTTPS.');
  }
  return { url: parsed.toString(), token };
}

async function httpCoordinatorTransport({ env, action, project, keyword, category, priority = 0 }) {
  const { url, token } = liveConfig(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, project, keyword, category, priority }),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new CoordinatorUnavailableError(
        `Coordinator returned invalid JSON (HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      throw new CoordinatorUnavailableError(
        `Coordinator rejected request (HTTP ${response.status}, ${payload?.error ?? 'unknown'}).`,
      );
    }
    return payload;
  } catch (error) {
    if (
      error instanceof CoordinatorUnavailableError ||
      error instanceof LiveModeBlockedError
    ) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new CoordinatorUnavailableError('Coordinator request timed out.');
    }
    throw new CoordinatorUnavailableError(
      `Coordinator request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function assertSafeCoordinatorResult(result) {
  if (!result || typeof result !== 'object') {
    throw new CoordinatorUnavailableError('Coordinator response could not be interpreted.');
  }
  if (result.actualApiCalled === true || result.quota?.actualApiCalled === true) {
    throw new LiveModeBlockedError(
      'Site client received a response indicating a real Coupang call. Site clients are queue/cache only.',
    );
  }
  return result;
}

export function createCoordinatorClient({
  project = PROJECT,
  env = process.env,
  transport,
} = {}) {
  const resolved = resolveMode(env);

  const safeCall = async (call, request) => {
    try {
      return assertSafeCoordinatorResult(await call({ env, project, ...request }));
    } catch (error) {
      if (
        error instanceof CoordinatorUnavailableError ||
        error instanceof LiveModeBlockedError ||
        error instanceof MockInProductionError
      ) {
        throw error;
      }
      throw new CoordinatorUnavailableError(
        `Coordinator unavailable: ${error instanceof Error ? error.message : 'unknown error'}.`,
      );
    }
  };

  const liveCall = async (request) => {
    const call = transport ?? httpCoordinatorTransport;
    return await safeCall(call, request);
  };

  return {
    project,
    mode: resolved.mode,

    async status() {
      if (!resolved.live) {
        return { status: 'mock', actualApiCalled: false };
      }
      return await liveCall({ action: 'status' });
    },

    async enqueueSearch({ keyword, category = '', priority = 0 } = {}) {
      if (typeof keyword !== 'string' || keyword.trim() === '') {
        throw new TypeError('keyword must be a non-empty string.');
      }

      if (!resolved.live) {
        assertNotProduction(env);
        return await safeCall(transport ?? mockTransport, {
          keyword,
          category,
          priority,
        });
      }

      return await liveCall({ action: 'enqueue', keyword, category, priority });
    },

    /**
     * Backward-compatible helper. In live mode this never runs Coupang itself:
     * it asks Coordinator for cache-or-queue. Cached responses may contain
     * products; queued responses intentionally return an empty product list.
     */
    async searchProducts({ keyword, category = '', priority = 0 } = {}) {
      const result = await this.enqueueSearch({ keyword, category, priority });
      return {
        status: result.status ?? (resolved.live ? 'queued' : 'mock'),
        products: Array.isArray(result.products) ? result.products : [],
        quota: { actualApiCalled: false },
        job: result.job ?? null,
        keywordHash: result.keywordHash ?? keywordHash(keyword, category),
      };
    },

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
