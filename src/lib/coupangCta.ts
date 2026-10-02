/**
 * 공개 쿠팡 CTA 링크 계산 (순수 함수).
 *
 * 모바일에서 정상 동작이 확인된 tracked canonical 형식만 내보낸다.
 *
 *   https://www.coupang.com/vp/products/{pageKey}
 *     ?itemId={itemId}&vendorItemId={vendorItemId}
 *     &lptag={stored}&subid={stored}&traceid={stored}
 *
 * identity(pageKey · itemId · vendorItemId)와 추적값(lptag · subid · traceid)은
 * 모두 저장된 값만 쓴다. 하나라도 없거나 추측·보완이 필요하면 null 을 돌려주고,
 * 화면은 링크 대신 "구매 링크 검증 중"을 보인다.
 *
 * - subid 를 새로 만들지 않는다. 저장된 subid 가 없으면 null.
 *   (Search API 원본 AFFSDP 는 subid 가 없으므로 exact 3-tuple 이 있어도 null)
 * - traceid 는 저장된 Deep Link landing 형식(V0-183-{hex})만 허용한다.
 *   Search 단계 값(V0-153-…)이나 그 밖의 형식은 null.
 * - 검색 URL(/np/search), 단축 URL(link.coupang.com/a/…), coupa.ng 은 해석하지 않는다.
 * - 반환 URL 에는 itemId · vendorItemId · lptag · subid · traceid 외 파라미터를 넣지 않는다.
 *   (requestid · token · clickBeacon · slot · pt · src · spec 등은 버린다)
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
  /** 저장된 값. 정확히 CMPICK_SUBID 여야 한다 */
  subid: string;
  traceid: string;
}

export interface CoupangCtaRegistry {
  /** product.id → 검증된 seed 의 exact identity */
  seedById?: Record<string, CoupangCtaIdentity>;
  /**
   * productId(= pageKey) → 중앙 affiliate registry 에 저장된 Deep Link landing URL 원문.
   * 원문 그대로 두고 parseExplicitIdentity 로 읽는다(값 변형 금지).
   */
  landingByProductId?: Record<string, string>;
}

/** CTA href 가 어느 저장값에서 왔는지 */
export type CoupangCtaSource = 'seed' | 'landing' | 'stored-url' | 'search-raw';

export interface CoupangCtaResolution {
  href: string | null;
  source: CoupangCtaSource | null;
}

export interface CoupangCtaProduct {
  id: string;
  coupangUrl: string;
  productId?: number | string | null;
}

const NUMERIC_ID = /^[1-9][0-9]{0,19}$/;
const TRACKING_VALUE = /^[A-Za-z0-9._-]{1,128}$/;
/** 저장된 Deep Link landing traceid 형식. Search 단계(V0-153-…)나 다른 형식은 거부한다 */
const LANDING_TRACEID = /^V0-183-[0-9a-f]+$/;
/** 중앙 Search API 원문 traceid. exact 저장 URL fallback 에만 쓴다 */
const SEARCH_TRACEID = /^V0-153-[0-9a-f]+$/;
const CMPICK_LPTAG = 'AF3873783';

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

function isLandingTraceid(value: unknown): value is string {
  return typeof value === 'string' && LANDING_TRACEID.test(value);
}

/** 모든 필드가 저장돼 있고 형식이 맞을 때만 tracked canonical 을 만든다 */
export function buildTrackedCanonical(identity: CoupangCtaIdentity): string | null {
  if (!identity || typeof identity !== 'object') return null;
  const { pageKey, itemId, vendorItemId, lptag, subid, traceid } = identity;
  if (!isNumericId(pageKey) || !isNumericId(itemId) || !isNumericId(vendorItemId)) return null;
  if (!isTrackingValue(lptag) || !isLandingTraceid(traceid)) return null;
  if (subid !== CMPICK_SUBID) return null;

  const query = new URLSearchParams([
    ['itemId', itemId],
    ['vendorItemId', vendorItemId],
    ['lptag', lptag],
    ['subid', subid],
    ['traceid', traceid],
  ]);
  return `https://${CANONICAL_HOST}/vp/products/${pageKey}?${query.toString()}`;
}

/**
 * 중앙 Search API가 저장한 exact AFFSDP 원문.
 * productId가 없는 카드에는 쓰지 않고 pageKey가 expectedProductId와 정확히 같아야 한다.
 * 링크를 재조립하거나 subid를 새로 붙이지 않는다.
 */
export function resolveStoredSearchAffiliateHref(
  rawUrl: string,
  expectedProductId: string | undefined,
): string | null {
  if (!expectedProductId || !isNumericId(expectedProductId)) return null;
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (url.hostname !== AFFSDP_HOST || url.pathname !== AFFSDP_PATH) return null;

  const params = url.searchParams;
  const pageKey = single(params, 'pageKey');
  const itemId = single(params, 'itemId');
  const vendorItemId = single(params, 'vendorItemId');
  const lptag = single(params, 'lptag');
  const traceid = single(params, 'traceid');
  const subid = single(params, 'subid');

  if (!isNumericId(pageKey) || !isNumericId(itemId) || !isNumericId(vendorItemId)) return null;
  if (pageKey !== expectedProductId) return null;
  if (lptag !== CMPICK_LPTAG || typeof traceid !== 'string' || !SEARCH_TRACEID.test(traceid)) return null;
  if (subid === null) return null;
  if (subid !== undefined && subid !== CMPICK_SUBID) return null;

  return rawUrl.trim();
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
  const subid = single(params, 'subid');
  const traceid = single(params, 'traceid');

  if (!isNumericId(pageKey) || !isNumericId(itemId) || !isNumericId(vendorItemId)) return null;
  if (!isTrackingValue(lptag) || !isLandingTraceid(traceid)) return null;
  // subid 는 저장된 값만 인정한다. 없으면 만들지 않는다.
  if (subid !== CMPICK_SUBID) return null;

  return { pageKey, itemId, vendorItemId, lptag, subid, traceid };
}

function own<T>(table: Record<string, T> | undefined, key: string | undefined): T | undefined {
  if (!table || key === undefined) return undefined;
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

function productKey(product: CoupangCtaProduct): string | undefined {
  if (product.productId === undefined || product.productId === null) return undefined;
  return String(product.productId);
}

const NONE: CoupangCtaResolution = { href: null, source: null };

/**
 * 공개 CTA href 와 그 출처. 저장된 exact identity 와 추적값이 모두 있을 때만 href 가 있다.
 *
 * A. seed:       seedById[product.id]
 * B. landing:    landingByProductId[product.productId] (원문 URL 의 pageKey 가 키와 같아야 한다)
 * C. stored-url: 저장된 coupangUrl 에 명시된 값(subid 포함)만
 * 어느 경우든 product.productId 가 있으면 pageKey 와 정확히 같아야 한다.
 */
export function resolveCoupangCta(
  product: CoupangCtaProduct,
  registry: CoupangCtaRegistry = {},
): CoupangCtaResolution {
  if (!product || typeof product.id !== 'string') return NONE;

  const key = productKey(product);
  let identity: CoupangCtaIdentity | null = null;
  let source: CoupangCtaSource;

  const seed = own(registry.seedById, product.id);
  const landingUrl = seed ? undefined : own(registry.landingByProductId, key);
  if (seed) {
    identity = seed;
    source = 'seed';
  } else if (landingUrl !== undefined) {
    identity = parseExplicitIdentity(landingUrl);
    if (identity && identity.pageKey !== key) return NONE;
    source = 'landing';
  } else {
    identity = parseExplicitIdentity(product.coupangUrl);
    if (identity) {
      source = 'stored-url';
    } else {
      const searchHref = resolveStoredSearchAffiliateHref(product.coupangUrl, key);
      if (searchHref) return { href: searchHref, source: 'search-raw' };
      return NONE;
    }
  }

  if (!identity) return NONE;
  if (key !== undefined && key !== identity.pageKey) return NONE;

  const href = buildTrackedCanonical(identity);
  return href ? { href, source } : NONE;
}

/** 공개 CTA href. 안전한 저장값이 없으면 null */
export function resolveCoupangTrackedHref(
  product: CoupangCtaProduct,
  registry: CoupangCtaRegistry = {},
): string | null {
  return resolveCoupangCta(product, registry).href;
}
