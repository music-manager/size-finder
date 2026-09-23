/**
 * 관리자 세션 토큰.
 *
 * 비밀번호는 절대 토큰 안에 넣지 않는다. 토큰은 "언제까지 유효한가" 와
 * 무작위 nonce 만 담고, ADMIN_SESSION_SECRET 으로 서명해 위조를 막는다.
 * 평문 authenticated=true 쿠키는 누구나 만들 수 있으므로 쓰지 않는다.
 *
 * node:crypto 만 쓴다. 별도 인증 라이브러리를 설치하지 않는다.
 */
import {
  createHmac as createSessionHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const ADMIN_COOKIE = 'cmpick_admin';

/** 세션 유효기간 — 24시간. 관리 페이지에 영구 로그인을 두지 않는다. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

const VERSION = 'v1';

/**
 * 길이가 달라도 터지지 않고 시간이 새지 않게 비교한다.
 * timingSafeEqual 은 길이가 다르면 예외를 던지므로 먼저 같은 길이로 해싱한다.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(String(a)).digest();
  const right = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(left, right);
}

/** 입력한 비밀번호가 맞는지. 설정이 비어 있으면 언제나 거짓이다 (fail closed). */
export function isPasswordCorrect(input: unknown, expected: string | undefined): boolean {
  if (typeof input !== 'string' || input === '') return false;
  if (typeof expected !== 'string' || expected === '') return false;
  return safeEqual(input, expected);
}

/** 관리자 세션 전용 HMAC. Coupang API 서명과는 무관하다. */
function sign(payload: string, secret: string): string {
  return createSessionHmac('sha256', secret).update(payload).digest('hex');
}

/** 서명된 세션 토큰을 만든다. 비밀번호는 담기지 않는다. */
export function createSessionToken(
  secret: string,
  now: number = Date.now(),
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
): string {
  const expiresAt = Math.floor(now / 1000) + maxAgeSeconds;
  const nonce = randomBytes(12).toString('hex');
  const payload = `${VERSION}.${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * 토큰이 우리가 발급한 것이고 아직 유효한지 본다.
 * 서명이 다르거나(변조), 기한이 지났거나, 설정이 없으면 거짓이다.
 */
export function verifySessionToken(
  token: unknown,
  secret: string | undefined,
  now: number = Date.now(),
): boolean {
  if (typeof token !== 'string' || token === '') return false;
  if (typeof secret !== 'string' || secret === '') return false;

  const parts = token.split('.');
  if (parts.length !== 4) return false;

  const [version, expiresRaw, nonce, signature] = parts;
  if (version !== VERSION) return false;
  if (!/^\d+$/.test(expiresRaw) || !/^[0-9a-f]+$/.test(nonce)) return false;

  const payload = `${version}.${expiresRaw}.${nonce}`;
  if (!safeEqual(signature, sign(payload, secret))) return false;

  return Number(expiresRaw) > Math.floor(now / 1000);
}

/** 두 환경변수가 모두 있어야 관리자 페이지를 연다. */
export function isAdminConfigured(env: {
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
}): boolean {
  return Boolean(env.ADMIN_PASSWORD) && Boolean(env.ADMIN_SESSION_SECRET);
}
