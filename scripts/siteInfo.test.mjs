/**
 * 운영자 정보와 개인정보처리방침이 사실과 어긋나지 않는지 본다.
 *
 * 방침은 법률 템플릿이 아니라 코드 감사 결과여야 한다. 그래서 "방침이
 * 주장하는 내용" 과 "코드의 실제 상태" 를 맞대어 검사한다.
 * 코드가 바뀌어 방침이 거짓이 되면 이 테스트가 깨진다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { ADMIN_COOKIE, SESSION_MAX_AGE_SECONDS } from '../src/lib/adminSession.ts';
import {
  AFFILIATE_NOTICE,
  OPERATOR_MAIL_HREF,
  OPERATOR_TEL_HREF,
  PRIVACY_EFFECTIVE_DATE,
  SITE_OPERATOR,
} from '../src/lib/siteInfo.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const privacy = read('src/app/privacy/page.tsx');
const footer = read('src/components/Footer.tsx');

function collect(dir, exts, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, exts, found);
    else if (exts.some((e) => entry.endsWith(e))) found.push(full);
  }
  return found;
}

const appSources = collect(join(ROOT, 'src'), ['.ts', '.tsx']).map((path) => ({
  path: relative(ROOT, path),
  code: readFileSync(path, 'utf8'),
}));
// 방침 문서 자체는 이 도구들을 "쓰지 않는다" 고 적으므로 검사 대상에서 뺀다
const runtime = appSources.filter((f) => f.path !== 'src/app/privacy/page.tsx');

describe('운영자 정보', () => {
  it('공개하기로 한 연락처가 그대로 들어 있다', () => {
    assert.equal(SITE_OPERATOR.name, '임창호');
    assert.equal(SITE_OPERATOR.phone, '010-2895-1000');
    assert.equal(SITE_OPERATOR.email, 'ktntopia@gmail.com');
  });

  it('전화는 tel:, 이메일은 mailto: 링크다', () => {
    assert.equal(OPERATOR_TEL_HREF, 'tel:01028951000');
    assert.equal(OPERATOR_MAIL_HREF, 'mailto:ktntopia@gmail.com');
  });

  it('운영자에게 근거 없는 지위를 붙이지 않는다', () => {
    // '호스팅 사업자' 처럼 제3자를 가리키는 말은 정상이므로,
    // 운영자를 그렇게 부르는 표현만 잡는다.
    const claims = [
      /대표\s*(이사|자)?\s*[:：]/,
      /대표\s*임창호/,
      /사업자\s*등록/,
      /고객\s*센터/,
      /법인\s*(명|등록)/,
      /상호\s*[:：]/,
    ];
    for (const text of [footer, privacy]) {
      for (const claim of claims) {
        assert.ok(!claim.test(text), `근거 없는 지위 표현: ${claim}`);
      }
    }
    // '사업자' 가 나온다면 반드시 제3자(호스팅 등)를 가리켜야 한다
    for (const match of privacy.matchAll(/(.{6})사업자/g)) {
      assert.match(
        match[1],
        /호스팅|해당|제공|통신/,
        `'사업자' 가 운영자를 가리키는 것처럼 쓰였다: ...${match[1]}사업자`,
      );
    }
  });

  it('푸터가 운영자·문의·개인정보처리방침을 모두 내보낸다', () => {
    assert.ok(footer.includes('운영자'));
    assert.ok(footer.includes('문의'));
    assert.ok(footer.includes('/privacy'));
    assert.ok(footer.includes('AFFILIATE_NOTICE'));
  });

  it('쿠팡 파트너스 고지 문구는 정책 문구 그대로다', () => {
    assert.equal(
      AFFILIATE_NOTICE,
      '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
    );
  });
});

describe('개인정보처리방침이 코드와 일치하는가', () => {
  it('시행일·최종수정일이 표기된다', () => {
    assert.match(PRIVACY_EFFECTIVE_DATE, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(privacy.includes('PRIVACY_EFFECTIVE_DATE'));
    assert.ok(privacy.includes('PRIVACY_UPDATED_DATE'));
  });

  it('"분석 도구가 없다" 는 서술이 실제로 참이다', () => {
    const trackers = /gtag\(|googletagmanager|google-analytics|mixpanel|amplitude|hotjar|clarity\.ms|fbq\(/i;
    const hits = runtime.filter((f) => trackers.test(f.code));
    assert.deepEqual(
      hits.map((f) => f.path),
      [],
      '방침은 분석 도구가 없다고 적었는데 코드에 추적 스크립트가 생겼다',
    );
  });

  it('"회원가입·주문·결제가 없다" 는 서술이 실제로 참이다', () => {
    const commerce = /type=["']email["']|type=["']tel["']|name=["'](email|phone|address|card)["']/i;
    const hits = runtime.filter((f) => commerce.test(f.code));
    assert.deepEqual(hits.map((f) => f.path), []);
  });

  it('일반 이용자용 쿠키가 없다는 서술이 참이다 (쿠키는 /admin 에서만)', () => {
    const cookieUsers = runtime.filter((f) => /cookies\(\)|document\.cookie/.test(f.code));
    for (const f of cookieUsers) {
      assert.ok(
        f.path.startsWith('src/app/admin/'),
        `${f.path} 가 /admin 밖에서 쿠키를 쓴다. 방침을 고쳐야 한다`,
      );
    }
  });

  it('방침이 말하는 쿠키 이름과 만료가 코드와 같다', () => {
    // 문자열이 아니라 실제 값을 본다. 24 -> 7일로 바꿔도 잡히게.
    assert.equal(ADMIN_COOKIE, 'cmpick_admin');
    assert.equal(
      SESSION_MAX_AGE_SECONDS,
      60 * 60 * 24,
      '방침은 24시간이라고 적었는데 코드의 세션 길이가 달라졌다',
    );
    assert.ok(privacy.includes('cmpick_admin'));
    assert.ok(privacy.includes('24시간'));
  });

  it('방침이 적은 외부 연결이 실제 설정과 같다', () => {
    const layout = read('src/app/layout.tsx');
    const nextConfig = read('next.config.mjs');
    assert.ok(layout.includes('cdn.jsdelivr.net'), '폰트 CDN 이 바뀌었다');
    assert.ok(nextConfig.includes('coupangcdn.com'), '이미지 호스트가 바뀌었다');
    for (const host of ['cdn.jsdelivr.net', 'coupangcdn.com', 'link.coupang.com']) {
      assert.ok(privacy.includes(host), `방침에 ${host} 안내가 빠졌다`);
    }
  });

  it('방침에 비밀번호·세션 비밀 같은 값이 들어 있지 않다', () => {
    for (const word of ['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'HMAC', 'timingSafeEqual']) {
      assert.ok(!privacy.includes(word), `방침이 내부 보안 세부를 노출한다: ${word}`);
    }
  });

  it('없는 기능을 있다고 쓰지 않는다', () => {
    // 부정문("받는 화면이 없습니다")은 정상이므로 단정형 주장만 잡는다
    const falseClaims = [
      /회원가입\s*시\s*(다음|아래)/,
      /주문\s*(내역|정보)\s*(을|를)\s*(수집|보관|저장)/,
      /결제\s*(정보|수단)\s*(을|를)\s*(수집|보관|저장)/,
      /마케팅\s*(정보|목적)[^.]{0,20}(수집|활용|이용)합니다/,
      /아이디\s*(와|및)\s*비밀번호를\s*수집/,
    ];
    for (const claim of falseClaims) {
      assert.ok(!claim.test(privacy), `없는 기능을 있다고 적었다: ${claim}`);
    }
    // 없다는 사실은 분명히 적혀 있어야 한다
    assert.ok(privacy.includes('회원가입·주문·결제 기능이 없습니다'));
  });

  it('확인하지 않은 단정을 쓰지 않는다', () => {
    assert.ok(
      !privacy.includes('개인정보를 전혀 수집하지 않습니다'),
      '호스팅 로그를 확인하지 않은 채 전면 부정을 단정하면 안 된다',
    );
    assert.ok(privacy.includes('접속 기록'), '호스팅 접속 기록 안내가 빠졌다');
  });
});
