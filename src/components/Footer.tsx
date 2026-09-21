import Link from 'next/link';
import LogoMark from './LogoMark';
import {
  AFFILIATE_NOTICE,
  OPERATOR_MAIL_HREF,
  OPERATOR_TEL_HREF,
  SITE_OPERATOR,
} from '@/lib/siteInfo';

export default function Footer() {
  return (
    // 페이지가 위에서 아래까지 하얗게만 이어지지 않도록 진한 색으로 닫는다
    <footer className="mt-16 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-extrabold leading-none text-white">
              센치<span className="text-brand-400">픽</span>
              <span className="ml-1.5 text-[11px] font-bold text-brand-400">
                CmPick
              </span>
            </p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              내 원룸 맞춤 가전·가구 실측 검색기
            </p>
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-slate-400">
          제품 치수는 제조사 공개 스펙 기준이며, 문고리·배관·걸레받이 등 설치
          환경에 따라 실제 필요 공간이 달라질 수 있습니다. 구매 전 실측 후 최소
          2~5cm 여유를 두고 확인하세요.
        </p>

        {/* 운영자 정보 — 본인이 공개를 요청한 연락처 */}
        <dl className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">운영자</dt>
            <dd className="font-semibold text-slate-200">{SITE_OPERATOR.name}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">문의</dt>
            <dd>
              <a
                href={OPERATOR_TEL_HREF}
                className="font-semibold text-slate-200 underline-offset-2 hover:text-brand-400 hover:underline"
              >
                {SITE_OPERATOR.phone}
              </a>
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">이메일</dt>
            <dd>
              <a
                href={OPERATOR_MAIL_HREF}
                className="font-semibold text-slate-200 underline-offset-2 hover:text-brand-400 hover:underline"
              >
                {SITE_OPERATOR.email}
              </a>
            </dd>
          </div>
        </dl>

        <p className="mt-5">
          <Link
            href="/privacy"
            className="text-xs font-bold text-brand-400 underline-offset-4 hover:text-brand-300 hover:underline"
          >
            개인정보처리방침
          </Link>
        </p>

        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
          <p className="text-xs leading-relaxed text-slate-300">{AFFILIATE_NOTICE}</p>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} 센치픽 (CmPick). All rights reserved.
        </p>
      </div>
    </footer>
  );
}
