/**
 * 히어로 오른쪽의 "공간 측정" 그림.
 * 외부 이미지를 쓰지 않고 인라인 SVG 선으로만 그린다 — 라이선스도, LCP 부담도 없다.
 */
export default function SpaceDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 170"
      className={className}
      fill="none"
      role="img"
      aria-label="가로·깊이·높이를 재는 방법을 보여주는 도식"
    >
      {/* 깊이 방향 면 */}
      <path
        d="M52 46 78 28h108l-26 18z"
        className="fill-brand-50 stroke-brand-300"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M160 46 186 28v92l-26 18z"
        className="fill-brand-100/70 stroke-brand-300"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* 정면 */}
      <rect
        x="52"
        y="46"
        width="108"
        height="92"
        rx="3"
        className="fill-white stroke-brand-500"
        strokeWidth="2"
      />

      {/* 가로 치수선 */}
      <g className="stroke-slate-400" strokeWidth="1.3" strokeLinecap="round">
        <path d="M52 152h108" />
        <path d="M52 147v10M160 147v10" />
      </g>
      <text
        x="106"
        y="167"
        textAnchor="middle"
        className="fill-slate-500 text-[11px] font-bold"
      >
        가로 W
      </text>

      {/* 높이 치수선 */}
      <g className="stroke-slate-400" strokeWidth="1.3" strokeLinecap="round">
        <path d="M38 46v92" />
        <path d="M33 46h10M33 138h10" />
      </g>
      <text
        x="24"
        y="96"
        textAnchor="middle"
        transform="rotate(-90 24 96)"
        className="fill-slate-500 text-[11px] font-bold"
      >
        높이 H
      </text>

      {/* 깊이 치수선 */}
      <g className="stroke-slate-400" strokeWidth="1.3" strokeLinecap="round">
        <path d="M168 40 194 22" />
        <path d="M164 36l8 8M190 18l8 8" />
      </g>
      <text
        x="196"
        y="14"
        textAnchor="middle"
        className="fill-slate-500 text-[11px] font-bold"
      >
        깊이 D
      </text>

      {/* 들어간다는 표시 */}
      <path
        d="m92 92 10 10 20-22"
        className="stroke-brand-600"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
