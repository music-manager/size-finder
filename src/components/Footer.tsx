import Link from 'next/link';
import LogoMark from './LogoMark';
import {
  AFFILIATE_NOTICE,
  OPERATOR_MAIL_HREF,
  OPERATOR_TEL_HREF,
  SITE_OPERATOR,
} from '@/lib/siteInfo';

interface Props {
  /**
   * 홈에는 모바일 하단 고정 필터 바가 있어, 그만큼 비워 두지 않으면
   * 푸터 맨 아래(저작권 줄)가 바에 가린다. 실제로 가려지는 것을 확인했다.
   */
  hasMobileBottomBar?: boolean;
}

export default function Footer({ hasMobileBottomBar = false }: Props) {
  return (
    // 헤더·히어로의 brand blue 와 같은 팔레트로 페이지를 닫는다.
    // 흰색으로 끝나면 브랜드가 이어지지 않고 그냥 잘린 느낌이 된다.
    <footer className="mt-16 bg-brand-900 text-brand-100">
      <div
        className={[
          'mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8 lg:pb-10',
          hasMobileBottomBar ? 'pb-28' : 'pb-10',
        ].join(' ')}
      >
        <div className="flex items-center gap-2.5">
          {/* 진한 배경 위에서는 심볼 바탕을 한 톤 밝게 해야 형태가 산다 */}
          <LogoMark className="h-10 w-10 shrink-0 text-brand-500" />
          <div>
            <p className="text-[15px] font-extrabold leading-none text-white">
              센치<span className="text-brand-300">픽</span>
              <span className="ml-1.5 text-[11px] font-bold text-brand-300">
                CmPick
              </span>
            </p>
            <p className="mt-1 text-xs font-medium text-brand-200">
              내 원룸 맞춤 가전·가구 실측 검색기
            </p>
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-brand-200">
          제품 치수는 제조사 공개 스펙 기준이며, 문고리·배관·걸레받이 등 설치
          환경에 따라 실제 필요 공간이 달라질 수 있습니다. 구매 전 실측 후 최소
          2~5cm 여유를 두고 확인하세요.
        </p>

        {/* 운영·문의 — 본인이 공개를 요청한 연락처 */}
        <dl className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          <div className="flex items-center gap-1.5">
            <dt className="text-brand-300">{SITE_OPERATOR.footerRole}</dt>
            <dd className="font-bold text-white">{SITE_OPERATOR.name}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">전화</dt>
            <dd>
              <a
                href={OPERATOR_TEL_HREF}
                className="font-bold text-white underline-offset-2 hover:text-brand-200 hover:underline"
              >
                {SITE_OPERATOR.phone}
              </a>
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">이메일</dt>
            <dd>
              <a
                href={OPERATOR_MAIL_HREF}
                className="font-bold text-white underline-offset-2 hover:text-brand-200 hover:underline"
              >
                {SITE_OPERATOR.email}
              </a>
            </dd>
          </div>
        </dl>

        <p className="mt-4">
          <Link
            href="/privacy"
            className="text-[13px] font-bold text-brand-200 underline underline-offset-4 transition hover:text-white"
          >
            개인정보처리방침
          </Link>
        </p>

        {/* 어두운 배경 안에서 한 톤 밝은 반투명 박스로 분리 */}
        <div className="mt-6 rounded-xl border border-white/15 bg-white/10 px-4 py-3">
          <p className="text-xs leading-relaxed text-brand-100">{AFFILIATE_NOTICE}</p>
        </div>

        {/* 위계를 가장 낮게 */}
        <p className="mt-6 text-[11px] text-brand-300/70">
          © {new Date().getFullYear()} 센치픽 (CmPick). All rights reserved.
        </p>
      </div>
    </footer>
  );
}
