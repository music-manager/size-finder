import crypto from 'node:crypto';

// 테스트에서 가짜 서버를 물릴 수 있도록 호스트를 바꿀 수 있게 둔다
const HOST = process.env.COUPANG_API_HOST || 'https://api-gateway.coupang.com';
const SEARCH_PATH = '/v2/providers/affiliate_open_api/apis/openapi/products/search';

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

/** 키워드 하나를 검색한다. 실패해도 예외를 던지지 않고 빈 배열을 돌려준다. */
export async function searchProducts(keyword, { limit = 20, accessKey, secretKey }) {
  const pathWithQuery = `${SEARCH_PATH}?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;

  const res = await fetch(`${HOST}${pathWithQuery}`, {
    method: 'GET',
    headers: {
      Authorization: authorization('GET', pathWithQuery, accessKey, secretKey),
      'Content-Type': 'application/json;charset=UTF-8',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
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
