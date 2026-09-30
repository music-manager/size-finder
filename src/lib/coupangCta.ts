/**
 * 공개 쿠팡 CTA 링크 계산 (순수 함수).
 *
 * 모바일에서 정상 동작이 확인된 tracked canonical 형식만 내보낸다.
 *
 *   https://www.coupang.com/vp/products/{pageKey}
 *     ?itemId={itemId}&vendorItemId={vendorItemId}
 *     &lptag={lptag}&subid=cmpick&traceid={traceid}
 *
 * identity(pageKey · itemId · vendorItemId)는 명시적으로 저장된 값만 쓴다.
 * 추측·보완이 필요하면 null 을 돌려주고, 화면은 링크 대신 "구매 링크 검증 중"을 보인다.
 *
 * - 검색 URL(/np/search), 단축 URL(link.coupang.com/a/…), coupa.ng 은 해석하지 않는다.
 * - 반환 URL 에는 itemId · vendorItemId · lptag · subid · traceid 외 파라미터를 넣지 않는다.
 *   (requestid · token · clickBeacon · slot · pt 등은 버린다)
 *
 * Node 테스트가 직접 import 하므로 경로 별칭·JSON import 를 쓰지 않는다.
 * registry 는 호출하는 쪽(coupangCtaLinks.ts)이 넘긴다.
 */

export const CMPICK_SUBID = 'cmpick';

export interface CoupangCtaIdentity {
  pageKey: string;
  itemId: string;
  vendorItemId: string;
  lptag: string;
  traceid: string;
  /** 없으면 CMPICK_SUBID. 있으면 정확히 CMPICK_SUBID 여야 한다 */
  subid?: string;
}

/** product.id → 확인된 identity. 검증된 seed 만 넣는다 */
export type CoupangCtaRegistry = Record<string, CoupangCtaIdentity>;

export interface CoupangCtaProduct {
  id: string;
  coupangUrl: string;
  productId?: number | string | null;
}

const NUMERIC_ID = /^[1-9][0-9]{0,19}$/;
const TRACKING_VALUE = /^[A-Za-z0-9._-]{1,128}$/;

const AFFSDP_HOST = 'link.coupang.com';
const AFFSDP_PATH = '/re/AFFSDP';
const CANONICAL_HOST = 'www.coupang.com';
const CANONICAL_PATH = /^\/vp\/products\/([0-9]+)$/;

function isNumericId(value: unknown): value is string {
  return typeof value === 'string' && NUMERIC_ID.test(value);
}

function isTrackingValue(value: unknown): value is string {
  return typeof value === 'string' && TRACKING_VALUE.test(value);
}

/** 모든 필드가 명시적이고 형식이 맞을 때만 tracked canonical 을 만든다 */
export function buildTrackedCanonical(identity: CoupangCtaIdentity): string | null {
  const { pageKey, itemId, vendorItemId, lptag, traceid } = identity;
  if (!isNumericId(pageKey) || !isNumericId(itemId) || !isNumericId(vendorItemId)) return null;
  if (!isTrackingValue(lptag) || !isTrackingValue(traceid)) return null;
  if (identity.subid !== undefined && identity.subid !== CMPICK_SUBID) return null;

  const query = new URLSearchParams([
    ['itemId', itemId],
    ['vendorItemId', vendorItemId],
    ['lptag', lptag],
    ['subid', CMPICK_SUBID],
    ['traceid', traceid],
  ]);
  return `https://${CANONICAL_HOST}/vp/products/${pageKey}?${query.toString()}`;
}

/** 같은 키가 두 번 이상이면 어느 값이 맞는지 모르므로 거부한다 */
function single(params: URLSearchParams, key: string): string | undefined | null {
  const values = params.getAll(key);
  if (values.length === 0) return undefined;
  if (values.length > 1) return null;
  return values[0];
}

/** 저장 URL 에 명시된 값만으로 identity 를 읽는다. 하나라도 빠지거나 모호하면 null */
export function parseExplicitIdentity(rawUrl: string): CoupangCtaIdentity | null {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;

  const params = url.searchParams;
  let pageKey: string | undefined | null;

  if (url.hostname === AFFSDP_HOST && url.pathname === AFFSDP_PATH) {
    pageKey = single(params, 'pageKey');
  } else if (url.hostname === CANONICAL_HOST) {
    const match = CANONICAL_PATH.exec(url.pathname);
    if (!match) return null;
    pageKey = match[1];
    const queryPageKey = single(params, 'pageKey');
    if (queryPageKey === null) return null;
    if (queryPageKey !== undefined && queryPageKey !== pageKey) return null;
  } else {
    return null;
  }

  const itemId = single(params, 'itemId');
  const vendorItemId = single(params, 'vendorItemId');
  const lptag = single(params, 'lptag');
  const traceid = single(params, 'traceid');
  const subid = single(params, 'subid');

  if (!isNumericId(pageKey) || !isNumericId(itemId) || !isNumericId(vendorItemId)) return null;
  if (!isTrackingValue(lptag) || !isTrackingValue(traceid)) return null;
  if (subid === null) return null;
  if (subid !== undefined && subid !== CMPICK_SUBID) return null;

  return { pageKey, itemId, vendorItemId, lptag, traceid, subid: CMPICK_SUBID };
}

/** product.productId 가 있으면 pageKey 와 정확히 같아야 한다 */
function matchesProductId(product: CoupangCtaProduct, pageKey: string): boolean {
  if (product.productId === undefined || product.productId === null) return true;
  return String(product.productId) === pageKey;
}

/**
 * 공개 CTA href. 안전한 exact identity 가 없으면 null.
 *
 * A. registry 에 product.id 가 있으면 registry 값만 쓴다.
 * B. 없으면 저장된 coupangUrl 에 명시된 값만 쓴다.
 */
export function resolveCoupangTrackedHref(
  product: CoupangCtaProduct,
  registry: CoupangCtaRegistry = {},
): string | null {
  if (!product || typeof product.id !== 'string') return null;

  const seeded = Object.prototype.hasOwnProperty.call(registry, product.id)
    ? registry[product.id]
    : undefined;
  const identity = seeded ?? parseExplicitIdentity(product.coupangUrl);
  if (!identity) return null;
  if (!matchesProductId(product, identity.pageKey)) return null;

  return buildTrackedCanonical(identity);
}
