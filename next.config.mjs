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
};

export default nextConfig;
