import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_NAME = '공간핏';
const SITE_TITLE = '내 원룸 맞춤 가전·가구 실측 검색기 (공간핏)';
const SITE_DESCRIPTION =
  '원룸·자취방 빈 공간의 가로·깊이·높이(cm)만 입력하면 실제로 들어가는 소형냉장고, 미니세탁기, 미니건조기, 전자레인지, 책상, 선반, 침대, 행거만 골라줍니다. 5평·7평·10평 평수별 프리셋 제공. 1인 가구 필수 가전·가구 실측 검색기.';
const SITE_URL = 'https://size.esedy.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    '원룸 가전',
    '소형냉장고 사이즈',
    '미니세탁기 크기',
    '자취방 가구',
    '원룸 책상 사이즈',
    '틈새 선반',
    '미니건조기 크기',
    '싱글 침대 사이즈',
    '5평 원룸 가전',
    '1인가구 가전',
    '실측 검색',
  ],
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d69f0',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
