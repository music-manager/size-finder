/**
 * 사이트 운영 정보.
 *
 * 푸터와 개인정보처리방침이 같은 값을 쓰도록 한 곳에 모아 둔다.
 * 운영자 본인이 공개를 요청한 연락처다.
 */
export const SITE_OPERATOR = {
  name: '임창호',
  phone: '010-2895-1000',
  email: 'ktntopia@gmail.com',
} as const;

/** 전화 걸기 링크용 (하이픈 제거) */
export const OPERATOR_TEL_HREF = `tel:${SITE_OPERATOR.phone.replace(/-/g, '')}`;
export const OPERATOR_MAIL_HREF = `mailto:${SITE_OPERATOR.email}`;

/** 개인정보처리방침 시행일 — 내용이 바뀌면 같이 갱신한다 */
export const PRIVACY_EFFECTIVE_DATE = '2026-09-21';
export const PRIVACY_UPDATED_DATE = '2026-09-21';

/** 쿠팡 파트너스 고지 문구 (정책상 문구 그대로 유지) */
export const AFFILIATE_NOTICE =
  '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
