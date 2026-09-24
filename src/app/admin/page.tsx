import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LogOut } from 'lucide-react';
import AdminTool from '@/components/AdminTool';
import AdminLiveBootstrap from '@/components/AdminLiveBootstrap';
import AdminLoginForm from '@/components/AdminLoginForm';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/adminSession';
import { getAllLiveProducts } from '@/lib/liveCatalog';
import { logout } from './actions';

export const metadata: Metadata = {
  title: '상품 관리',
  // 운영용 페이지이므로 검색엔진에 노출하지 않는다
  robots: { index: false, follow: false },
};

/** 쿠키와 실시간 상품 DB를 보므로 캐시하지 않는다 */
export const dynamic = 'force-dynamic';

type PendingStateRow = {
  id?: string;
  status?: 'registered' | 'skipped';
};

/**
 * 관리자 배지 숫자도 실제 DB 대기열 처리 상태를 기준으로 맞춘다.
 * 조회 실패 시 null을 반환해 브라우저의 기존 로컬 상태를 덮어쓰지 않는다.
 */
async function getPendingDoneIds(): Promise<string[] | null> {
  const baseUrl = process.env.SUPABASE_URL;
  const adminToken = process.env.CMPICK_ADMIN_API_TOKEN;
  if (!baseUrl || !adminToken) return null;

  try {
    const response = await fetch(`${baseUrl}/functions/v1/cmpick-admin-api`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'pending_state' }),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { rows?: PendingStateRow[] };
    if (!Array.isArray(data.rows)) return [];

    return data.rows
      .filter(
        (row): row is Required<Pick<PendingStateRow, 'id' | 'status'>> =>
          typeof row.id === 'string' &&
          (row.status === 'registered' || row.status === 'skipped'),
      )
      .map((row) => row.id);
  } catch {
    return null;
  }
}

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

export default async function AdminPage() {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  // 설정이 없으면 관리 도구를 절대 내보내지 않는다 (fail closed)
  if (!password || !secret) return <ConfigError />;

  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!verifySessionToken(token, secret)) return <AdminLoginForm />;

  // 관리자는 검증 대기 상품까지 포함한 전체 목록과 대기열 처리 상태를 함께 본다.
  const [liveProducts, pendingDoneIds] = await Promise.all([
    getAllLiveProducts(),
    getPendingDoneIds(),
  ]);

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
      <AdminLiveBootstrap products={liveProducts} doneIds={pendingDoneIds} />
      <AdminTool />
    </>
  );
}
