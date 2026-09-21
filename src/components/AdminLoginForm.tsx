'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Lock } from 'lucide-react';
import LogoMark from './LogoMark';
import { login, type LoginState } from '@/app/admin/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? '확인 중…' : '로그인'}
    </button>
  );
}

/**
 * 관리자 로그인 화면.
 *
 * 비밀번호는 서버 액션으로만 보낸다. 쿼리스트링에도, localStorage 에도,
 * 클라이언트 번들에도 남지 않는다.
 */
export default function AdminLoginForm() {
  const [state, formAction] = useFormState<LoginState, FormData>(login, {});

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center text-center">
          <LogoMark className="h-14 w-14 text-brand-600" />
          <h1 className="mt-3 text-lg font-extrabold tracking-tight text-slate-900">
            관리자 로그인
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            센치<span className="font-bold text-brand-600">픽</span> 상품 관리
          </p>
        </div>

        <form action={formAction} className="mt-6">
          <label
            htmlFor="admin-password"
            className="block text-xs font-bold text-slate-600"
          >
            비밀번호
          </label>
          <div className="mt-1.5 flex items-center rounded-xl border border-slate-300 bg-white px-3 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full min-w-0 bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none"
            />
          </div>

          {state.error && (
            <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
