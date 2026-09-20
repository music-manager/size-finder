/** 수집한 상품을 센치픽 데이터 형식으로 다듬는 함수들 */

const TAG_HINTS = [
  [/로켓\s*배송|로켓와우/, '로켓배송'],
  [/로켓\s*설치/, '로켓설치'],
  [/무설치/, '무설치'],
  [/고객\s*직접\s*설치|직접\s*설치/, '직접설치'],
  [/설치\s*불필요/, '설치불필요'],
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

export function buildTags(text, { isRocket, isFreeShipping }) {
  const tags = [];
  if (isRocket) tags.push('로켓배송');
  for (const [re, tag] of TAG_HINTS) {
    if (tags.length >= 4) break;
    if (re.test(text) && !tags.includes(tag)) tags.push(tag);
  }
  if (tags.length < 4 && isFreeShipping && !tags.includes('무료배송')) {
    tags.push('무료배송');
  }
  return tags;
}

/**
 * 상품명에 적힌 치수를 cm 로 뽑는다.
 * "600x450x720", "60*45*72cm", "520 x 434 x 640mm" 등을 인식한다.
 * 단위가 없으면 200 이상을 mm 로 본다.
 */
export function extractDimensions(text) {
  const m = text.match(
    /(\d{1,4}(?:\.\d+)?)\s*(?:mm|cm)?\s*[x*×✕X]\s*(\d{1,4}(?:\.\d+)?)\s*(?:mm|cm)?\s*[x*×✕X]\s*(\d{1,4}(?:\.\d+)?)\s*(mm|cm)?/i,
  );
  if (!m) return null;

  const unit = m[4]?.toLowerCase();
  const toCm = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    const cm = unit === 'mm' || (!unit && n >= 200) ? n / 10 : n;
    return Math.round(cm * 10) / 10;
  };

  const width = toCm(m[1]);
  const depth = toCm(m[2]);
  const height = toCm(m[3]);
  if (width === null || depth === null || height === null) return null;
  // 가구·가전에서 말이 되는 범위만 채택한다
  if ([width, depth, height].some((v) => v < 5 || v > 250)) return null;
  return { width, depth, height };
}

/** 용량(2.5kg / 86L / 6인용 / 3단)과 모델코드를 스펙 문자열로 묶는다 */
export function extractSpec(name) {
  const capacity = name.match(/\d+(?:\.\d+)?\s*(?:kg|KG|Kg|L|ℓ|리터|인용|단)\b/)?.[0];
  const modelCode = name.match(/\b[A-Z][A-Z0-9]{2,}(?:[-/][A-Z0-9]+)*\b/)?.[0];
  return [capacity, modelCode].filter(Boolean).join(' · ');
}

/** 한국 상품명은 보통 브랜드가 맨 앞에 온다 */
export function extractBrand(name) {
  const first = name.trim().split(/\s+/)[0] ?? '';
  // "[단독]" 같은 머리말은 브랜드가 아니다
  return /^[[(]/.test(first) ? (name.trim().split(/\s+/)[1] ?? '') : first;
}

/** 쿠팡 썸네일 주소는 그대로 쓴다. 해상도 경로를 바꾸면 없는 상품에서 깨진다. */
export function cleanImageUrl(url) {
  return typeof url === 'string' ? url.trim() : '';
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
