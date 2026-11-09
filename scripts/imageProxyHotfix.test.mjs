/**
 * P0 image hotfix: browser must not request ads-partners.coupang.com directly.
 * Next/Image optimizer keeps the stored source URL/provenance unchanged while
 * serving the rendered image from the site's own /_next/image endpoint.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('Coupang image ad-block hotfix', () => {
  it('VERIFIED card and detail use optimized Next/Image', () => {
    for (const file of ['src/components/ProductCard.tsx', 'src/components/ProductDetail.tsx']) {
      const src = read(file);
      assert.match(src, /import Image from 'next\/image'/, file);
      assert.doesNotMatch(src, /\bunoptimized\b/, file);
      assert.match(src, /<Image[\s\S]*?src=\{imageSrc\}/, file);
    }
  });

  it('REVIEW card also uses optimized Next/Image instead of a direct img request', () => {
    const src = read('src/components/ReviewCard.tsx');
    assert.match(src, /import Image from 'next\/image'/);
    assert.match(src, /<Image[\s\S]*?src=\{candidate\.imageUrl\}[\s\S]*?fill/);
    assert.doesNotMatch(src, /<img[\s\S]*?src=\{candidate\.imageUrl\}/);
  });

  it('ads-partners remains an allowed remote source; stored URLs are not rewritten', () => {
    const config = read('next.config.mjs');
    assert.match(config, /hostname: 'ads-partners\.coupang\.com'/);
    assert.match(config, /pathname: '\/image1\/\*\*'/);
  });
});
