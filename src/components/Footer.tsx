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
    <footer className="mt-6 bg-brand-900 text-brand-100 sm:mt-8">
      <div
        className={[
          'mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-7 lg:px-8 lg:pb-7 lg:pt-8',
          hasMobileBottomBar ? 'pb-28' : 'pb-6 sm:pb-7',
        ].join(' ')}
      >
        {/* 데스크톱은 2열 — 왼쪽 브랜드, 오른쪽 연락처 */}
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              {/* 진한 파랑 위에서는 심볼을 한 톤 밝게 해야 형태가 산다 */}
              <LogoMark className="h-9 w-9 shrink-0 text-brand-500" />
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
            <p className="mt-3 text-xs leading-relaxed text-brand-200">
              치수는 제조사 공개 스펙 기준입니다. 설치 환경에 따라 달라질 수
              있으니 구매 전 실측 후 2~5cm 여유를 두세요.
            </p>
          </div>

          {/* 운영·문의 — 본인이 공개를 요청한 연락처 */}
          <div className="sm:text-right">
            <dl className="text-[13px]">
              <div className="flex flex-wrap items-baseline gap-x-2 sm:justify-end">
                <dt className="text-brand-300">{SITE_OPERATOR.footerRole}</dt>
                <dd className="font-bold text-white">{SITE_OPERATOR.name}</dd>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:justify-end">
                <dt className="sr-only">전화</dt>
                <dd>
                  <a
                    href={OPERATOR_TEL_HREF}
                    className="font-bold text-white underline-offset-2 hover:text-brand-200 hover:underline"
                  >
                    {SITE_OPERATOR.phone}
                  </a>
                </dd>
                <span className="text-brand-300/60" aria-hidden="true">
                  ·
                </span>
                <dt className="sr-only">이메일</dt>
                <dd>
                  <a
                    href={OPERATOR_MAIL_HREF}
                    className="break-all font-bold text-white underline-offset-2 hover:text-brand-200 hover:underline"
                  >
                    {SITE_OPERATOR.email}
                  </a>
                </dd>
              </div>
            </dl>
            <p className="mt-2">
              <Link
                href="/privacy"
                className="text-[13px] font-bold text-brand-200 underline underline-offset-4 transition hover:text-white"
              >
                개인정보처리방침
              </Link>
            </p>
          </div>
        </div>

        {/* 어두운 배경 안에서 한 톤 밝은 얇은 바로 분리 */}
        <p className="mt-4 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-[11px] leading-relaxed text-brand-100">
          {AFFILIATE_NOTICE}
        </p>

        {/* 위계를 가장 낮게 */}
        <p className="mt-3 text-[11px] text-brand-300/70">
          © {new Date().getFullYear()} 센치픽 (CmPick). All rights reserved.
        </p>
      </div>
    </footer>
  );
}
