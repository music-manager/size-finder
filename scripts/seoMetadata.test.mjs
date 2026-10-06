/**
 * 루트 layout 의 SEO metadata.
 * 네이버 서치어드바이저는 페이지 설명 · Open Graph 설명이 80자를 넘으면 경고한다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LAYOUT = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
const SITE_DESCRIPTION = LAYOUT.match(/const SITE_DESCRIPTION =\s*'([^']+)';/)[1];

describe('루트 layout SEO metadata', () => {
  it('SITE_DESCRIPTION 은 80자 이하', () => {
    assert.equal(
      SITE_DESCRIPTION,
      '원룸·자취방 빈 공간의 가로·깊이·높이를 입력하면 실제로 들어가는 소형가전·가구를 골라주는 실측 검색기입니다.',
    );
    assert.ok([...SITE_DESCRIPTION].length <= 80, String([...SITE_DESCRIPTION].length));
  });

  it('description · openGraph.description 모두 SITE_DESCRIPTION 을 쓴다', () => {
    assert.match(LAYOUT, /^ {2}description: SITE_DESCRIPTION,$/m);
    assert.match(LAYOUT, /openGraph: \{[^}]*\n {4}description: SITE_DESCRIPTION,\n/);
  });

  it('네이버 사이트 소유확인 메타를 유지한다', () => {
    assert.match(LAYOUT, /'naver-site-verification': '79aa07201becd73ba3197e8da28744236e5f0356'/);
  });
});
