import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const robots = read('src/app/robots.ts');

describe('robots.ts 검색로봇 접근 정책', () => {
  it('네이버 Yeti 를 명시적으로 허용한다', () => {
    assert.match(robots, /userAgent:\s*['"]Yeti['"]/);
    assert.match(robots, /allow:\s*['"]\/['"]/);
  });

  it('일반 검색로봇도 허용하고 admin 은 제외한다', () => {
    assert.match(robots, /userAgent:\s*['"]\*['"]/);
    const adminMatches = robots.match(/disallow:\s*['"]\/admin['"]/g) || [];
    assert.ok(adminMatches.length >= 2);
  });

  it('운영 sitemap 주소를 유지한다', () => {
    assert.match(robots, /https:\/\/cmpick\.esedy\.com\/sitemap\.xml/);
  });
});
