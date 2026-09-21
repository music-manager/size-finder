/**
 * 히어로 오른쪽 그림 — "집 안의 빈 자리를 재는 장면".
 *
 * 추상 큐브 대신 실제 설치 맥락(벽·바닥·옆 수납장·비어 있는 자리)을 그린다.
 * 특정 가전 한 종류를 찾는 사이트처럼 보이면 안 되므로, 들어갈 자리는
 * 점선 실루엣으로만 두고 안을 채우지 않는다.
 * 외부 이미지를 쓰지 않고 인라인 SVG 선으로만 그린다 — 라이선스도, LCP 부담도 없다.
 * 사람·손은 그리지 않는다.
 */
export default function SpaceDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 172"
      className={className}
      fill="none"
      role="img"
      aria-label="원룸 벽면에 비어 있는 자리를 가로·깊이·높이로 재는 그림"
    >
      {/* 벽 */}
      <path
        d="M10 6h220v112H10z"
        className="fill-amber-50 stroke-amber-200"
        strokeWidth="1.5"
      />
      {/* 바닥 — 앞으로 퍼지게 해서 방 안쪽을 내려다보는 각을 만든다 */}
      <path
        d="M10 118h220l10 36H0z"
        className="fill-amber-100/80 stroke-amber-200"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 옆에 이미 있는 수납장 — "이것 옆의 빈 자리" 라는 맥락을 만든다 */}
      <rect
        x="22"
        y="40"
        width="46"
        height="78"
        rx="3"
        className="fill-white stroke-stone-400"
        strokeWidth="1.6"
      />
      <g className="stroke-stone-300" strokeWidth="1.4" strokeLinecap="round">
        <path d="M22 68h46" />
        <path d="M60 54v9M60 78v9" />
      </g>

      {/* 자리의 윗면 — 깊이 방향이 벽 안쪽으로 들어간다 */}
      <path
        d="M84 44 102 30h84l-18 14z"
        className="fill-brand-100/60 stroke-brand-400"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        strokeLinejoin="round"
      />
      {/* 비어 있는 자리 — 들어갈 제품의 점선 실루엣 */}
      <rect
        x="84"
        y="44"
        width="84"
        height="74"
        rx="3"
        className="fill-brand-50/80 stroke-brand-500"
        strokeWidth="1.8"
        strokeDasharray="6 4"
      />
      {/* 재는 중이라는 신호 — 네 귀퉁이 브래킷 */}
      <g
        className="stroke-brand-600"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M92 56v-6h7M160 56v-6h-7M92 106v6h7M160 106v6h-7" />
      </g>

      {/* 가로 W — 바닥 위에 눕힌다 */}
      <g className="stroke-slate-500" strokeWidth="1.4" strokeLinecap="round">
        <path d="M84 132h84" />
        <path d="M84 127v10M168 127v10" />
      </g>
      <text
        x="126"
        y="150"
        textAnchor="middle"
        className="fill-slate-600 text-[11px] font-bold"
      >
        가로 W
      </text>

      {/* 높이 H */}
      <g className="stroke-slate-500" strokeWidth="1.4" strokeLinecap="round">
        <path d="M200 44v74" />
        <path d="M195 44h10M195 118h10" />
      </g>
      <text
        x="216"
        y="81"
        textAnchor="middle"
        transform="rotate(-90 216 81)"
        className="fill-slate-600 text-[11px] font-bold"
      >
        높이 H
      </text>

      {/* 깊이 D — 윗면의 기울어진 모서리를 그대로 따라간다 */}
      <g className="stroke-slate-500" strokeWidth="1.4" strokeLinecap="round">
        <path d="M78 40 96 26" />
        <path d="M74 36l8 8M92 22l8 8" />
      </g>
      <text
        x="76"
        y="19"
        textAnchor="middle"
        className="fill-slate-600 text-[11px] font-bold"
      >
        깊이 D
      </text>

      {/* 줄자 — 이 사이트가 무엇으로 재는지 한눈에 */}
      <rect
        x="14"
        y="126"
        width="34"
        height="26"
        rx="8"
        className="fill-white stroke-stone-400"
        strokeWidth="1.6"
      />
      <circle
        cx="31"
        cy="139"
        r="7"
        className="stroke-stone-400"
        strokeWidth="1.6"
      />
      <g className="stroke-amber-400" strokeWidth="3" strokeLinecap="round">
        <path d="M48 139h24" />
      </g>
    </svg>
  );
}
