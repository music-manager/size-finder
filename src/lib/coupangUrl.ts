export function isRawCoupangSearchAffiliateUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.hostname === 'link.coupang.com' &&
      parsed.pathname === '/re/AFFSDP' &&
      (parsed.searchParams.has('requestid') || parsed.searchParams.has('token'))
    );
  } catch {
    return false;
  }
}
