export function toSafeCoupangProductUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  // 쿠팡 Partners Search API가 반환하는 AFFSDP URL 중 requestid/token을
  // 포함한 저장 링크는 장기 보관 후 "사용권한 없음"으로 차단되는 사례가 있다.
  // 이 일시성 Search API 링크만 깨끗한 상품 URL로 되돌리고, 공식 short/deeplink
  // 등 다른 제휴 URL은 그대로 유지한다.
  const isRawSearchAffiliateUrl =
    parsed.hostname === 'link.coupang.com' &&
    parsed.pathname === '/re/AFFSDP' &&
    (parsed.searchParams.has('requestid') || parsed.searchParams.has('token'));

  if (!isRawSearchAffiliateUrl) return rawUrl;

  const pageKey = parsed.searchParams.get('pageKey')?.trim();
  const itemId = parsed.searchParams.get('itemId')?.trim();
  const vendorItemId = parsed.searchParams.get('vendorItemId')?.trim();

  if (!/^\d+$/.test(pageKey ?? '') || !/^\d+$/.test(itemId ?? '') || !/^\d+$/.test(vendorItemId ?? '')) {
    return rawUrl;
  }

  const clean = new URL(`https://www.coupang.com/vp/products/${pageKey}`);
  clean.searchParams.set('itemId', itemId!);
  clean.searchParams.set('vendorItemId', vendorItemId!);
  return clean.toString();
}
