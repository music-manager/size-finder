import type { Metadata } from 'next';
import AdminTool from '@/components/AdminTool';

export const metadata: Metadata = {
  title: '상품 관리',
  // 운영용 페이지이므로 검색엔진에 노출하지 않는다
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminTool />;
}
