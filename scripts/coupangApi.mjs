import crypto from 'node:crypto';

// 테스트에서 가짜 서버를 물릴 수 있도록 호스트를 바꿀 수 있게 둔다
const HOST = process.env.COUPANG_API_HOST || 'https://api-gateway.coupang.com';
const SEARCH_PATH = '/v2/providers/affiliate_open_api/apis/openapi/products/search';

export const SEARCH_LIMIT_MIN = 1;
export const SEARCH_LIMIT_MAX = 10;

/**
 * 쿠팡이 "시간당 호출 한도를 넘었다" 고 알려줄 때 던진다.
 * 수집 루프는 이 오류를 만나면 즉시 멈추고 더 이상 API 를 부르지 않는다.
 */
export class CoupangRateLimitError extends Error {
  constructor(message, { status, usage, body } = {}) {
    super(message);
    this.name = 'CoupangRateLimitError';
    this.isRateLimit = true;
    this.status = status ?? null;
    this.usage = usage ?? null;
    this.body = body ?? '';
  }
}

// 쿠팡은 한도 초과 메시지를 한국어/영어 어느 쪽으로도 준다
const HOURLY_MARKER = /시간\s*당|hourly|per\s+hour/i;
const USAGE_COUNT = [
  /(\d[\d,]*)\s*(?:회|번|건|times?|calls?|requests?)/i,
  /(?:횟수|사용량|count|usage|limit)\D{0,20}(\d[\d,]*)/i,
];

/**
 * 403 응답 본문에 시간당 사용 횟수 정보가 들어 있는지 본다.
 * 한도 초과로 보이면 { usage } 를, 아니면 null 을 돌려준다.
 * 횟수 숫자를 못 읽어도 "시간당" 표현만 있으면 한도 초과로 본다.
 * 판단이 애매할 때 계속 호출하는 쪽이 더 위험하기 때문이다.
 */
export function parseHourlyRateLimit(status, body) {
  if (status !== 403) return null;
  const text = String(body ?? '');
  if (!HOURLY_MARKER.test(text)) return null;

  for (const re of USAGE_COUNT) {
    const matched = text.match(re);
    if (matched) return { usage: matched[1] };
  }
  return { usage: null };
}

/**
 * 쿠팡 Open API 의 CEA HMAC 서명을 만든다.
 * 서명 대상 문자열은 signed-date + METHOD + path + query(물음표 제외) 순서다.
 */
function authorization(method, pathWithQuery, accessKey, secretKey) {
  const [path, query = ''] = pathWithQuery.split('?');
  const signedDate =
    new Date().toISOString().slice(2, 19).replace(/[-:]/g, '') + 'Z';
  const message = signedDate + method + path + query;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

/**
 * 키워드 하나를 검색한다. 상품검색 API limit 은 1~10만 허용한다.
 * 범위를 벗어난 limit 은 요청을 보내기 전에 RangeError 로 막는다.
 * 시간당 한도 초과(403)는 CoupangRateLimitError 로, 그 밖의 실패는 Error 로 던진다.
 */
export async function searchProducts(keyword, { limit = 10, accessKey, secretKey }) {
  const numericLimit = Number(limit);
  if (
    !Number.isInteger(numericLimit) ||
    numericLimit < SEARCH_LIMIT_MIN ||
    numericLimit > SEARCH_LIMIT_MAX
  ) {
    throw new RangeError(
      `쿠팡 상품검색 limit은 ${SEARCH_LIMIT_MIN}~${SEARCH_LIMIT_MAX}만 허용됩니다. 받은 값: ${limit}`,
    );
  }

  const pathWithQuery = `${SEARCH_PATH}?keyword=${encodeURIComponent(keyword)}&limit=${numericLimit}`;

  const res = await fetch(`${HOST}${pathWithQuery}`, {
    method: 'GET',
    headers: {
      Authorization: authorization('GET', pathWithQuery, accessKey, secretKey),
      'Content-Type': 'application/json;charset=UTF-8',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const rateLimit = parseHourlyRateLimit(res.status, body);
    if (rateLimit) {
      throw new CoupangRateLimitError(
        `쿠팡 시간당 호출 한도 초과 (HTTP ${res.status}` +
          `${rateLimit.usage ? `, 사용 ${rateLimit.usage}회` : ''})`,
        { status: res.status, usage: rateLimit.usage, body: body.slice(0, 200) },
      );
    }
    throw new Error(`HTTP ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json.rCode && json.rCode !== '0') {
    throw new Error(`쿠팡 API 오류 ${json.rCode}: ${json.rMessage ?? ''}`);
  }
  return json?.data?.productData ?? [];
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
