import Link from 'next/link';
import LogoMark from './LogoMark';
import { AFFILIATE_NOTICE } from '@/lib/siteInfo';

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
          'mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-7 lg:px-8 lg:pb-5 lg:pt-6',
          hasMobileBottomBar ? 'pb-28' : 'pb-6 sm:pb-7',
        ].join(' ')}
      >
        {/* 데스크톱은 2열 — 왼쪽 브랜드, 오른쪽 링크 */}
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
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

          {/* 연락처 원문은 /privacy 의 보호책임자 카드에 둔다.
              홈 푸터에는 전화번호·이메일을 그대로 노출하지 않는다. */}
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-bold sm:justify-end">
            <Link
              href="/privacy"
              className="text-brand-200 underline underline-offset-4 transition hover:text-white"
            >
              개인정보처리방침
            </Link>
            <Link
              href="/privacy#contact"
              className="text-brand-200 underline underline-offset-4 transition hover:text-white"
            >
              문의
            </Link>
          </nav>
        </div>

        {/* 제휴 고지와 저작권을 한 줄에 묶어 푸터가 더 자라지 않게 한다.
            고지는 쿠팡 파트너스 정책상 필수라 한 톤 밝은 바로 남겨 둔다. */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-[11px] leading-relaxed text-brand-100">
            {AFFILIATE_NOTICE}
          </p>
          {/* 위계를 가장 낮게 */}
          <p className="shrink-0 text-[11px] text-brand-300/70">
            © {new Date().getFullYear()} 센치픽 (CmPick). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
