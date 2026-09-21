'use server';

import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isPasswordCorrect,
} from '@/lib/adminSession';

export interface LoginState {
  error?: string;
}

/**
 * 같은 인스턴스 안에서만 세는 실패 횟수.
 *
 * Netlify 는 요청마다 다른 인스턴스로 갈 수 있어 이것만으로 무차별 대입을
 * 막을 수는 없다. 보안장치가 아니라 "한 인스턴스에서 초당 수백 번 때리는"
 * 명백한 경우를 늦추는 완충일 뿐이다. 진짜 방어는 긴 비밀번호다.
 */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function clientKey(): string {
  const header = headers();
  const forwarded = header.get('x-nf-client-connection-ip') ?? header.get('x-forwarded-for');
  return (forwarded ?? 'unknown').split(',')[0].trim();
}

function tooManyAttempts(key: string, now: number): boolean {
  const seen = attempts.get(key);
  if (!seen) return false;
  if (now - seen.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return seen.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string, now: number): void {
  const seen = attempts.get(key);
  if (!seen || now - seen.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }
  seen.count += 1;
}

/** 실패했을 때 어떤 이유인지 알려주지 않는다. 설정 상태도 노출하지 않는다. */
const GENERIC_ERROR = '비밀번호가 올바르지 않습니다.';

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const now = Date.now();
  const key = clientKey();

  if (tooManyAttempts(key, now)) {
    return { error: '잠시 후 다시 시도해 주세요.' };
  }

  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  // 설정이 없으면 열어주지 않는다 (fail closed)
  if (!password || !secret) {
    recordFailure(key, now);
    return { error: GENERIC_ERROR };
  }

  if (!isPasswordCorrect(formData.get('password'), password)) {
    recordFailure(key, now);
    // 스크립트로 빠르게 반복하는 것을 조금이라도 늦춘다
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { error: GENERIC_ERROR };
  }

  attempts.delete(key);

  cookies().set({
    name: ADMIN_COOKIE,
    value: createSessionToken(secret, now),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return {};
}

export async function logout(): Promise<void> {
  cookies().set({
    name: ADMIN_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 0,
  });
}
