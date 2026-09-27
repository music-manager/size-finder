export function toSafeCoupangProductUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  // 쿠팡 Partners Search API가 반환하는 AFFSDP URL은 requestid/token 등
  // 일시성 추적 파라미터를 포함할 수 있다. 장기 저장 후 직접 열면 쿠팡에서
  // "사용권한 없음"으로 차단되는 사례가 있어, pageKey/itemId/vendorItemId가
  // 모두 있으면 깨끗한 상품 URL로 되돌린다.
  if (parsed.hostname !== 'link.coupang.com' || parsed.pathname !== '/re/AFFSDP') {
    return rawUrl;
  }

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
