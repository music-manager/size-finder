import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'Yeti', allow: '/', disallow: '/admin' },
      { userAgent: '*', allow: '/', disallow: '/admin' },
    ],
    sitemap: 'https://cmpick.esedy.com/sitemap.xml',
  };
}
