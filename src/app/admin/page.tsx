import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LogOut } from 'lucide-react';
import AdminTool from '@/components/AdminTool';
import AdminLoginForm from '@/components/AdminLoginForm';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/adminSession';
import { logout } from './actions';

export const metadata: Metadata = {
  title: '상품 관리',
  // 운영용 페이지이므로 검색엔진에 노출하지 않는다
  robots: { index: false, follow: false },
};

/** 쿠키를 봐야 하므로 캐시하지 않는다 */
export const dynamic = 'force-dynamic';

function ConfigError() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-base font-extrabold text-slate-900">
          관리자 인증이 설정되지 않았습니다
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          이 페이지는 설정이 끝날 때까지 열리지 않습니다.
          <br />
          배포 환경의 관리자 인증 설정을 확인해 주세요.
        </p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  // 설정이 없으면 관리 도구를 절대 내보내지 않는다 (fail closed)
  if (!password || !secret) return <ConfigError />;

  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!verifySessionToken(token, secret)) return <AdminLoginForm />;

  return (
    <>
      <div className="mx-auto flex max-w-5xl items-center justify-end px-4 pt-4">
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-400 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            로그아웃
          </button>
        </form>
      </div>
      <AdminTool />
    </>
  );
}
