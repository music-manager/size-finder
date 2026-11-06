// netlify.toml 의 [[headers]] 는 정적 파일에만 붙고 SSR HTML 응답에는 붙지 않는다.
// 같은 값을 Next 응답에도 붙여 HTML 페이지까지 맞춘다. 값은 netlify.toml 과 같아야 한다.
// Referrer-Policy 는 쿠팡 파트너스 추적 때문에 strict-origin-when-cross-origin 보다 엄격하게 바꾸지 않는다.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'source.unsplash.com' },
      { protocol: 'https', hostname: '*.coupangcdn.com' },
      { protocol: 'https', hostname: 'ads-partners.coupang.com', pathname: '/image1/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
