import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  OPERATOR_MAIL_HREF,
  OPERATOR_TEL_HREF,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_UPDATED_DATE,
  SITE_OPERATOR,
} from '@/lib/siteInfo';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    '센치픽(CmPick)이 실제로 처리하는 정보와 쿠키, 외부 연결, 문의처를 안내합니다.',
  alternates: { canonical: '/privacy' },
};

/**
 * 이 문서는 법률 템플릿을 옮겨 적은 것이 아니라, 저장소 코드를 직접 확인한
 * 사실만 적었다. 확인한 것과 확인할 수 없는 것을 구분해 쓴다.
 *
 * 코드 기준으로 확인한 사실 (2026-09-21):
 *  - 분석·추적 스크립트 없음 (GA/GTM/픽셀류 검색 결과 0건)
 *  - 회원가입·주문·결제·마케팅 수신 폼 없음
 *  - 일반 이용자용 쿠키 없음. cmpick_admin 은 운영자 로그인 전용
 *  - 관리 도구의 localStorage 는 운영자 브라우저에만 남고 서버로 가지 않음
 *  - 외부 연결: cdn.jsdelivr.net(폰트), *.coupangcdn.com(이미지),
 *    link.coupang.com(제휴 링크 클릭 시)
 */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="text-xs text-slate-400">
          <Link href="/" className="hover:text-brand-600 hover:underline">
            홈
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-slate-600">개인정보처리방침</span>
        </nav>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
          개인정보처리방침
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          센치픽(CmPick, 이하 &lsquo;사이트&rsquo;)은 이용자의 개인정보를 소중히
          다룹니다. 이 방침은 사이트가 <strong>실제로 하는 처리</strong>만 적은
          것이며, 하지 않는 일을 형식적으로 나열하지 않았습니다.
        </p>

        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
          <p className="text-[13px] font-semibold leading-relaxed text-brand-900">
            사이트는 회원가입·주문·결제 기능이 없습니다. 이름, 연락처, 주소,
            결제수단 같은 정보를 입력받는 곳이 없으며 수집하지 않습니다.
          </p>
        </div>

        <Section title="1. 사이트가 직접 수집하는 정보">
          <p>
            <strong>일반 이용자에게서 직접 수집하는 개인정보는 없습니다.</strong>{' '}
            회원가입, 주문, 결제, 마케팅 수신 동의를 받는 화면이 없습니다.
          </p>
          <p>
            검색에 입력하는 가로·깊이·높이 숫자와 검색어는 화면 주소(URL)에만
            반영되어 링크 공유에 쓰입니다. 사이트가 이를 따로 저장하거나 다른
            정보와 연결하지 않습니다. 다만 주소는 웹 요청의 일부이므로 아래
            3항의 접속 기록에는 남을 수 있습니다.
          </p>
        </Section>

        <Section title="2. 쿠키">
          <p>
            <strong>일반 이용자에게는 쿠키를 사용하지 않습니다.</strong> 광고·분석
            목적의 쿠키도 사용하지 않습니다.
          </p>
          <p>
            운영자 전용 관리 화면(<code className="rounded bg-slate-100 px-1">/admin</code>
            )에 로그인한 경우에만 <code className="rounded bg-slate-100 px-1">cmpick_admin</code>{' '}
            쿠키 하나가 발급됩니다.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>목적: 관리 화면 로그인 상태 유지</li>
            <li>보관 기간: 발급 후 24시간, 이후 자동 만료</li>
            <li>
              적용 범위: <code className="rounded bg-slate-100 px-1">/admin</code>{' '}
              경로에서만 전송되며, 자바스크립트로 읽을 수 없습니다
            </li>
            <li>내용: 유효 기간과 무작위 값뿐이며 비밀번호는 담기지 않습니다</li>
            <li>로그아웃하면 즉시 삭제됩니다</li>
          </ul>
          <p>
            관리 화면에서 작성 중인 상품 임시 저장 내용은 운영자 본인 브라우저
            저장소에만 남고 서버로 전송되지 않습니다.
          </p>
        </Section>

        <Section title="3. 접속 기록 (호스팅)">
          <p>
            사이트는 Netlify를 통해 제공됩니다. 웹사이트를 제공하는 과정에서
            호스팅 사업자 측에 IP 주소, 접속 시각, 요청 주소 같은 기술적 접속
            기록이 남을 수 있습니다. 이는 서비스 제공과 장애 대응에 필요한
            범위이며, 사이트 운영자가 이 기록을 별도로 내려받아 보관하거나 다른
            정보와 결합해 이용하지 않습니다.
          </p>
          <p className="text-slate-500">
            호스팅 사업자의 로그 보관 기간과 처리 방식은 해당 사업자의 정책을
            따릅니다. 이 부분은 사이트 코드로 확인할 수 있는 범위를 벗어나므로
            단정하지 않고 사실대로 안내합니다.
          </p>
        </Section>

        <Section title="4. 분석 도구">
          <p>
            <strong>
              현재 이 사이트에는 접속자 분석 도구나 광고 추적 스크립트가 설치되어
              있지 않습니다.
            </strong>{' '}
            Google Analytics를 비롯한 분석·추적 도구를 사용하지 않습니다. 향후
            도입할 경우 이 방침을 먼저 갱신하겠습니다.
          </p>
        </Section>

        <Section title="5. 외부로 연결되는 요소">
          <p>
            화면을 그리는 과정에서 이용자 브라우저가 아래 외부 주소에 직접
            접속합니다. 이때 해당 사업자에게 IP 주소 등 통신에 필요한 정보가
            전달될 수 있습니다.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <code className="rounded bg-slate-100 px-1">cdn.jsdelivr.net</code> —
              본문 글꼴(Pretendard)
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">*.coupangcdn.com</code> —
              상품 이미지
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">link.coupang.com</code> —
              &lsquo;쿠팡에서 보기&rsquo; 를 눌렀을 때 이동하는 주소
            </li>
          </ul>
          <p>
            외부 사이트로 이동한 뒤의 처리는 해당 사이트의 개인정보처리방침을
            따릅니다.
          </p>
        </Section>

        <Section title="6. 쿠팡 파트너스 안내">
          <p>
            이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를
            제공받습니다. 상품 링크를 눌러 쿠팡으로 이동하면 쿠팡이 자체 정책에
            따라 쿠키 등을 사용할 수 있습니다. 구매 여부나 구매 내역 같은 개인
            단위 정보를 사이트가 받아 보지는 않습니다.
          </p>
          <p>
            외부로 이동할 때 사이트는 전체 주소가 아니라 출처 도메인까지만
            전달하도록 설정되어 있습니다.
          </p>
        </Section>

        <Section title="7. 보유 및 이용 기간">
          <ul className="ml-4 list-disc space-y-1">
            <li>일반 이용자에게서 수집해 보관하는 개인정보: 없음</li>
            <li>
              관리자 로그인 쿠키: 24시간 후 자동 만료, 로그아웃 시 즉시 삭제
            </li>
            <li>
              호스팅 접속 기록: 호스팅 사업자의 정책에 따름 (운영자가 별도 보관하지
              않음)
            </li>
          </ul>
        </Section>

        <Section title="8. 이용자의 권리">
          <p>
            사이트가 보관하는 이용자 개인정보가 없으므로 열람·정정·삭제를 처리할
            대상이 존재하지 않습니다. 다만 개인정보 처리와 관련해 궁금한 점이나
            요청이 있으면 아래 연락처로 알려주시면 확인 후 답변드리겠습니다.
          </p>
        </Section>

        <Section title="9. 문의처">
          <ul className="ml-4 list-disc space-y-1">
            <li>운영자: {SITE_OPERATOR.name}</li>
            <li>
              문의:{' '}
              <a
                href={OPERATOR_TEL_HREF}
                className="font-semibold text-brand-700 underline-offset-2 hover:underline"
              >
                {SITE_OPERATOR.phone}
              </a>
            </li>
            <li>
              이메일:{' '}
              <a
                href={OPERATOR_MAIL_HREF}
                className="font-semibold text-brand-700 underline-offset-2 hover:underline"
              >
                {SITE_OPERATOR.email}
              </a>
            </li>
          </ul>
        </Section>

        <Section title="10. 방침 변경">
          <p>
            이 방침의 내용이 바뀌면 이 페이지에 수정 내용과 시행일을 표시합니다.
          </p>
          <p className="text-slate-500">
            시행일: {PRIVACY_EFFECTIVE_DATE}
            <span className="mx-2">·</span>
            최종 수정일: {PRIVACY_UPDATED_DATE}
          </p>
        </Section>
      </main>
      <Footer />
    </>
  );
}
