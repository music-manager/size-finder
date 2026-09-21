/**
 * 관리자 세션 토큰 테스트.
 *
 * 실제 ADMIN_PASSWORD / ADMIN_SESSION_SECRET 은 쓰지 않는다.
 * 이 파일에 등장하는 문자열은 전부 테스트용 가짜다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isAdminConfigured,
  isPasswordCorrect,
  safeEqual,
  verifySessionToken,
} from '../src/lib/adminSession.ts';

// 테스트 전용 더미. 운영 값과 무관하다.
const FAKE_SECRET = 'test-only-secret-not-real';
const OTHER_SECRET = 'test-only-other-secret';
const FAKE_PASSWORD = 'test-only-password';

describe('설정 여부 (fail closed)', () => {
  it('둘 다 있어야 열린다', () => {
    assert.equal(
      isAdminConfigured({ ADMIN_PASSWORD: FAKE_PASSWORD, ADMIN_SESSION_SECRET: FAKE_SECRET }),
      true,
    );
  });

  it('ADMIN_PASSWORD 가 없으면 닫는다', () => {
    assert.equal(isAdminConfigured({ ADMIN_SESSION_SECRET: FAKE_SECRET }), false);
    assert.equal(
      isAdminConfigured({ ADMIN_PASSWORD: '', ADMIN_SESSION_SECRET: FAKE_SECRET }),
      false,
    );
  });

  it('ADMIN_SESSION_SECRET 이 없으면 닫는다', () => {
    assert.equal(isAdminConfigured({ ADMIN_PASSWORD: FAKE_PASSWORD }), false);
    assert.equal(
      isAdminConfigured({ ADMIN_PASSWORD: FAKE_PASSWORD, ADMIN_SESSION_SECRET: '' }),
      false,
    );
  });

  it('설정이 비면 어떤 비밀번호도 통과하지 못한다', () => {
    assert.equal(isPasswordCorrect(FAKE_PASSWORD, undefined), false);
    assert.equal(isPasswordCorrect(FAKE_PASSWORD, ''), false);
    assert.equal(isPasswordCorrect('', ''), false);
  });

  it('설정이 비면 어떤 토큰도 통과하지 못한다', () => {
    const token = createSessionToken(FAKE_SECRET);
    assert.equal(verifySessionToken(token, undefined), false);
    assert.equal(verifySessionToken(token, ''), false);
  });
});

describe('비밀번호 확인', () => {
  it('정확히 같아야 통과한다', () => {
    assert.equal(isPasswordCorrect(FAKE_PASSWORD, FAKE_PASSWORD), true);
  });

  it('틀리면 거부한다', () => {
    assert.equal(isPasswordCorrect('wrong', FAKE_PASSWORD), false);
    assert.equal(isPasswordCorrect(FAKE_PASSWORD + 'x', FAKE_PASSWORD), false);
    assert.equal(isPasswordCorrect(FAKE_PASSWORD.toUpperCase(), FAKE_PASSWORD), false);
  });

  it('빈 값이나 문자열이 아니면 거부한다', () => {
    for (const bad of ['', null, undefined, 0, {}, []]) {
      assert.equal(isPasswordCorrect(bad, FAKE_PASSWORD), false, String(bad));
    }
  });

  it('길이가 달라도 예외 없이 비교한다', () => {
    assert.equal(safeEqual('a', 'aaaaaaaaaaaaaaaaaaaa'), false);
    assert.equal(safeEqual('같음', '같음'), true);
  });
});

describe('세션 토큰', () => {
  it('올바른 비밀로 만들면 검증을 통과한다', () => {
    const token = createSessionToken(FAKE_SECRET);
    assert.equal(verifySessionToken(token, FAKE_SECRET), true);
  });

  it('토큰에 비밀번호나 비밀키가 들어 있지 않다', () => {
    const token = createSessionToken(FAKE_SECRET);
    assert.ok(!token.includes(FAKE_SECRET), '비밀키가 토큰에 노출됐다');
    assert.ok(!token.includes(FAKE_PASSWORD), '비밀번호가 토큰에 노출됐다');
  });

  it('매번 다른 토큰이 나온다 (nonce)', () => {
    const a = createSessionToken(FAKE_SECRET);
    const b = createSessionToken(FAKE_SECRET);
    assert.notEqual(a, b);
  });

  it('다른 비밀키로 서명된 토큰은 거부한다', () => {
    const token = createSessionToken(OTHER_SECRET);
    assert.equal(verifySessionToken(token, FAKE_SECRET), false);
  });

  it('서명을 변조하면 거부한다', () => {
    const token = createSessionToken(FAKE_SECRET);
    const parts = token.split('.');
    parts[3] = parts[3].replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    assert.equal(verifySessionToken(parts.join('.'), FAKE_SECRET), false);
  });

  it('만료 시각을 늘리면 거부한다 (서명이 깨진다)', () => {
    const token = createSessionToken(FAKE_SECRET);
    const parts = token.split('.');
    parts[1] = String(Number(parts[1]) + 60 * 60 * 24 * 365);
    assert.equal(verifySessionToken(parts.join('.'), FAKE_SECRET), false);
  });

  it('평문 authenticated=true 같은 값은 거부한다', () => {
    for (const fake of ['authenticated=true', 'true', '1', 'v1.9999999999.abc.deadbeef']) {
      assert.equal(verifySessionToken(fake, FAKE_SECRET), false, fake);
    }
  });

  it('형식이 깨지면 거부한다', () => {
    for (const bad of ['', 'a.b.c', 'a.b.c.d.e', null, undefined, 42]) {
      assert.equal(verifySessionToken(bad, FAKE_SECRET), false, String(bad));
    }
  });

  it('기한이 지나면 거부한다', () => {
    const issuedAt = Date.now();
    const token = createSessionToken(FAKE_SECRET, issuedAt);

    const justBefore = issuedAt + (SESSION_MAX_AGE_SECONDS - 10) * 1000;
    assert.equal(verifySessionToken(token, FAKE_SECRET, justBefore), true);

    const justAfter = issuedAt + (SESSION_MAX_AGE_SECONDS + 10) * 1000;
    assert.equal(verifySessionToken(token, FAKE_SECRET, justAfter), false);
  });

  it('세션은 7일을 넘지 않는다', () => {
    assert.ok(SESSION_MAX_AGE_SECONDS <= 60 * 60 * 24 * 7);
    assert.ok(SESSION_MAX_AGE_SECONDS >= 60 * 60 * 24);
  });

  it('쿠키 이름이 정해져 있다', () => {
    assert.equal(ADMIN_COOKIE, 'cmpick_admin');
  });
});
