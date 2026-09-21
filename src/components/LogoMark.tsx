interface Props {
  className?: string;
}

/**
 * 센치픽 심볼 — 집 윤곽 안에 체크(맞는 사이즈)와 줄자 눈금(실측)을 담았다.
 * 래스터 이미지 대신 인라인 SVG 로 두어 파비콘·헤더 어느 크기에서도 선명하게 쓴다.
 *
 * 헤더에서 48~52px 로 키우면서 체크와 눈금이 뭉개지지 않도록 선 굵기를 조금 올렸다.
 */
export default function LogoMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      role="img"
      aria-label="센치픽"
    >
      <rect width="40" height="40" rx="11" fill="currentColor" />
      <g
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      >
        {/* 굴뚝 */}
        <path d="M27.9 15.5V10.8h2.5v6.7" />
        {/* 집 윤곽 */}
        <path d="M8.2 18.6 20 9.4l11.8 9.2V31H8.2z" />
        {/* 사이즈가 맞는다는 표시 */}
        <path d="M14.9 22.1l3.3 3.3 6-6.2" strokeWidth="3.1" />
        {/* 줄자 눈금 */}
        <path d="M12 31v-2.7M16 31v-4.1M20 31v-2.7M24 31v-4.1M28 31v-2.7" strokeWidth="2.1" />
      </g>
    </svg>
  );
}
