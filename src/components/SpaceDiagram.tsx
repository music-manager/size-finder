/**
 * 히어로 오른쪽 그림 — 치수 도면(blueprint).
 *
 * 생활 일러스트(집·냉장고·줄자)를 쓰지 않는다. 이 사이트는 분위기를 파는
 * 곳이 아니라 치수를 재는 도구이므로, 와이어프레임 박스 하나와 W/D/H
 * 치수선만 남긴다. 어두운 히어로 위에서 읽히도록 선 위주로 그린다.
 * 외부 이미지를 쓰지 않는다 — 라이선스도, LCP 부담도 없다.
 */
export default function SpaceDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 180"
      className={className}
      fill="none"
      role="img"
      aria-label="공간을 가로·깊이·높이로 재는 치수 도면"
    >
      <defs>
        {/* 도면 느낌의 옅은 격자 — 글자 가독성을 해치지 않게 아주 낮은 농도 */}
        <pattern
          id="cmpick-blueprint-grid"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M12 0H0v12"
            className="stroke-slate-600"
            strokeWidth="0.5"
            opacity="0.45"
          />
        </pattern>
      </defs>
      <rect width="240" height="180" fill="url(#cmpick-blueprint-grid)" />

      {/* 공간을 뜻하는 와이어프레임 박스 — 뒤쪽 모서리 */}
      <g
        className="stroke-slate-500"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M82 28h110v92" />
        <path d="M62 46 82 28M172 46l20-18M172 138l20-18" />
      </g>

      {/* 앞면 — 실제로 재는 면 */}
      <rect
        x="62"
        y="46"
        width="110"
        height="92"
        className="fill-brand-500/10 stroke-brand-400"
        strokeWidth="1.6"
      />

      {/* 가로 W — 눈금자 틱을 얹어 '재는 중' 임을 드러낸다 */}
      <g className="stroke-slate-400" strokeWidth="1.1" strokeLinecap="round">
        <path d="M62 152h110" />
        <path d="M62 148v8M172 148v8" />
      </g>
      <g className="stroke-slate-500" strokeWidth="1" strokeLinecap="round">
        <path d="M73 152v4M84 152v4M95 152v4M106 152v4M117 152v4M128 152v4M139 152v4M150 152v4M161 152v4" />
      </g>
      <text
        x="117"
        y="172"
        textAnchor="middle"
        className="fill-brand-300 text-[12px] font-extrabold"
      >
        W
      </text>

      {/* 높이 H */}
      <g className="stroke-slate-400" strokeWidth="1.1" strokeLinecap="round">
        <path d="M208 46v92" />
        <path d="M204 46h8M204 138h8" />
      </g>
      <text
        x="225"
        y="96"
        textAnchor="middle"
        className="fill-brand-300 text-[12px] font-extrabold"
      >
        H
      </text>

      {/* 깊이 D — 뒤로 물러나는 모서리를 그대로 따라간다 */}
      <g className="stroke-slate-400" strokeWidth="1.1" strokeLinecap="round">
        <path d="M48 40 68 22" />
        <path d="M44 36l7 7M64 18l7 7" />
      </g>
      <text
        x="42"
        y="18"
        textAnchor="middle"
        className="fill-brand-300 text-[12px] font-extrabold"
      >
        D
      </text>
    </svg>
  );
}
