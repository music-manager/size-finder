/**
 * Convert cached Coupang Search API productData into CmPick metadata without
 * guessing product identity or dimensions.
 *
 * Automatic merge is intentionally strict:
 *   1) existing productId matches, or
 *   2) same brand + one clear alphanumeric model code matches.
 * Everything else goes to pending for human review.
 */

const TAG_HINTS = [
  [/로켓\s*배송|로켓와우/, '로켓배송'],
  [/로켓\s*설치/, '로켓설치'],
  [/무설치/, '무설치'],
  [/직접\s*설치/, '직접설치'],
  [/인버터/, '인버터'],
  [/저소음|정숙/, '저소음'],
  [/히트\s*펌프/, '히트펌프'],
  [/1등급|일등급/, '1등급'],
  [/벽걸이/, '벽걸이'],
  [/접이식|폴딩/, '접이식'],
  [/초슬림|슬림/, '슬림'],
  [/틈새/, '틈새수납'],
  [/바퀴|이동식/, '바퀴형'],
  [/대용량/, '대용량'],
  [/1인\s*가구|원룸|자취/, '원룸추천'],
];

const BRAND_ALIASES = new Map([
  ['lg전자', 'lg'],
  ['lg', 'lg'],
  ['엘지전자', 'lg'],
  ['삼성전자', '삼성'],
  ['삼성', '삼성'],
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function normalizeBrand(value) {
  const raw = text(value).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  return BRAND_ALIASES.get(raw) ?? raw;
}

export function extractBrand(name) {
  const parts = text(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0];
  if (/^[[(]/.test(first)) return parts[1] ?? '';
  return first;
}

export function extractModelCodes(value) {
  const upper = text(value).toUpperCase();
  const tokens = upper.match(/[A-Z0-9][A-Z0-9._/-]{2,}/g) ?? [];
  return [...new Set(tokens
    .map((token) => token.replace(/^[._/-]+|[._/-]+$/g, ''))
    .filter((token) => token.length >= 4)
    .filter((token) => /[A-Z]/.test(token) && /\d/.test(token))
    .filter((token) => !/^\d+(?:KG|CM|MM|ML|L|W|V)$/.test(token)))];
}

/**
 * Title-only dimension parsing is a candidate, never an official measurement.
 */
export function extractDimensionCandidate(value) {
  const source = text(value);
  const match = source.match(
    /(\d{1,4}(?:\.\d+)?)\s*(?:mm|cm)?\s*[x*×✕X]\s*(\d{1,4}(?:\.\d+)?)\s*(?:mm|cm)?\s*[x*×✕X]\s*(\d{1,4}(?:\.\d+)?)\s*(mm|cm)?/i,
  );
  if (!match) return null;

  const unit = match[4]?.toLowerCase();
  const toCm = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    const cm = unit === 'mm' || (!unit && n >= 200) ? n / 10 : n;
    return Math.round(cm * 10) / 10;
  };

  const values = [toCm(match[1]), toCm(match[2]), toCm(match[3])];
  if (values.some((v) => v === null || v < 5 || v > 250)) return null;

  return {
    width: values[0],
    depth: values[1],
    height: values[2],
    source: 'title_parse',
    verified: false,
  };
}

export function buildTags(name, raw = {}) {
  const tags = [];
  if (raw.isRocket === true) tags.push('로켓배송');
  for (const [re, tag] of TAG_HINTS) {
    if (tags.length >= 4) break;
    if (re.test(name) && !tags.includes(tag)) tags.push(tag);
  }
  if (tags.length < 4 && raw.isFreeShipping === true && !tags.includes('무료배송')) {
    tags.push('무료배송');
  }
  return tags;
}

export function normalizeCoupangProduct(raw, { category, keyword = '' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const productId = raw.productId === undefined || raw.productId === null
    ? ''
    : String(raw.productId).trim();
  const name = text(raw.productName);
  const coupangUrl = text(raw.productUrl);
  if (!productId || !name || !coupangUrl || !text(category)) return null;

  const price = positiveNumber(raw.productPrice);
  const imageUrl = text(raw.productImage);
  const rank = Number.isInteger(Number(raw.rank)) && Number(raw.rank) > 0
    ? Number(raw.rank)
    : undefined;
  const brand = extractBrand(name);

  return {
    productId,
    name,
    category: text(category),
    brand,
    coupangUrl,
    imageUrl,
    ...(price ? { price } : {}),
    ...(rank ? { rank } : {}),
    tags: buildTags(name, raw),
    sourceKeyword: text(keyword),
    source: 'coupang_search',
    dimensionCandidate: extractDimensionCandidate(name),
  };
}

function modelMatch(seed, candidate) {
  const seedBrand = normalizeBrand(seed.brand || extractBrand(seed.name));
  const candidateBrand = normalizeBrand(candidate.brand || extractBrand(candidate.name));
  if (!seedBrand || seedBrand !== candidateBrand) return false;

  const a = new Set(extractModelCodes(seed.name));
  const b = extractModelCodes(candidate.name);
  if (!a.size || !b.length) return false;
  return b.some((code) => a.has(code));
}

/** Return exactly one automatic match, otherwise null. Ambiguity is pending. */
export function findAutomaticMatch(products, candidate) {
  if (!Array.isArray(products) || !candidate) return null;

  const byProductId = products.filter(
    (item) => item.productId && String(item.productId) === String(candidate.productId),
  );
  if (byProductId.length === 1) return { product: byProductId[0], reason: 'productId' };
  if (byProductId.length > 1) return null;

  const byModel = products.filter((item) => modelMatch(item, candidate));
  return byModel.length === 1 ? { product: byModel[0], reason: 'brand_model' } : null;
}

export function mergeApiMetadata(seed, candidate, now = new Date().toISOString()) {
  const tags = [...new Set([...(Array.isArray(seed.tags) ? seed.tags : []), ...candidate.tags])].slice(0, 6);
  return {
    ...seed,
    productId: candidate.productId,
    coupangUrl: candidate.coupangUrl,
    imageUrl: candidate.imageUrl,
    ...(candidate.price ? { price: candidate.price } : {}),
    tags,
    apiMetadata: {
      source: 'coupang_search',
      sourceKeyword: candidate.sourceKeyword,
      rank: candidate.rank ?? null,
      updatedAt: now,
      matchReason: null,
    },
    // Deliberately preserve seed.dimensions and seed.verified.
  };
}

export function toPending(candidate) {
  return {
    id: `cp-${candidate.productId}`,
    productId: candidate.productId,
    name: candidate.name,
    category: candidate.category,
    brand: candidate.brand,
    coupangUrl: candidate.coupangUrl,
    imageUrl: candidate.imageUrl,
    ...(candidate.price ? { price: candidate.price } : {}),
    tags: candidate.tags,
    verified: false,
    source: 'coupang_search',
    sourceKeyword: candidate.sourceKeyword,
    rank: candidate.rank ?? null,
    ...(candidate.dimensionCandidate ? { dimensionCandidate: candidate.dimensionCandidate } : {}),
  };
}

/**
 * Pure batch transform. It never writes files and never calls any network.
 */
export function applyCachedProducts({ products, pending, rawProducts, category, keyword, now }) {
  const nextProducts = products.map((item) => ({ ...item }));
  const nextPending = pending.map((item) => ({ ...item }));
  const pendingIds = new Set(nextPending.map((item) => String(item.productId ?? '')));
  const existingIds = new Set(nextProducts.map((item) => String(item.productId ?? '')));

  const report = { received: 0, invalid: 0, matched: 0, pending: 0, skippedDuplicate: 0 };

  for (const raw of Array.isArray(rawProducts) ? rawProducts : []) {
    report.received += 1;
    const candidate = normalizeCoupangProduct(raw, { category, keyword });
    if (!candidate) {
      report.invalid += 1;
      continue;
    }

    const match = findAutomaticMatch(nextProducts, candidate);
    if (match) {
      const index = nextProducts.findIndex((item) => item.id === match.product.id);
      const merged = mergeApiMetadata(nextProducts[index], candidate, now);
      merged.apiMetadata.matchReason = match.reason;
      nextProducts[index] = merged;
      existingIds.add(candidate.productId);
      report.matched += 1;
      continue;
    }

    if (existingIds.has(candidate.productId) || pendingIds.has(candidate.productId)) {
      report.skippedDuplicate += 1;
      continue;
    }

    nextPending.push(toPending(candidate));
    pendingIds.add(candidate.productId);
    report.pending += 1;
  }

  return { products: nextProducts, pending: nextPending, report };
}
