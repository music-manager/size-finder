/**
 * 치수 입력 정규화와 "얼마나 여유 있게 들어가는지" 계산.
 *
 * 이 파일은 일부러 products.json 이나 다른 모듈에 의존하지 않는다.
 * 숫자만 받아 숫자를 돌려주므로 브라우저 없이 그대로 테스트할 수 있다.
 */

export interface DimensionTriple {
  maxWidth: number;
  maxDepth: number;
  maxHeight: number;
}

export interface FitInput {
  /** 제품 가로 (cm) */
  width: number;
  /** 제품 깊이 (cm). 도어 여유가 필요한 제품이면 그것까지 더한 값을 넘긴다 */
  depth: number;
  /** 제품 높이 (cm) */
  height: number;
  /** 사용자가 입력한 공간 (cm) */
  maxWidth: number;
  maxDepth: number;
  maxHeight: number;
}

/** 이 값 이하로 남으면 "딱 맞음" 으로 본다 (cm) */
export const TIGHT_FIT_CM = 5;

/** 소수점 오차로 딱 맞는 제품이 탈락하지 않도록 허용하는 오차 (filterProducts 와 동일) */
const EPSILON = 0.05;

/**
 * 사용자가 입력한 공간 대비, 세 축 중 가장 빠듯한 여유(cm)를 돌려준다.
 * 한 축이라도 들어가지 않으면 null 이다. 값이 숫자가 아니어도 null 이다.
 */
export function fitClearance(input: FitInput): number | null {
  const gaps = [
    input.maxWidth - input.width,
    input.maxDepth - input.depth,
    input.maxHeight - input.height,
  ];

  if (gaps.some((gap) => !Number.isFinite(gap))) return null;
  // 애초에 filterProducts 에서 걸러지지만, 음수 여유를 배지로 내보내지 않는다
  if (gaps.some((gap) => gap < -EPSILON)) return null;

  const tightest = Math.min(...gaps);
  return tightest < 0 ? 0 : tightest;
}

/** 여유(cm)를 사용자에게 보여줄 문구로 바꾼다 */
export function fitLabel(clearance: number): string {
  if (clearance <= TIGHT_FIT_CM) return '딱 맞음';
  return `최소 ${formatClearance(clearance)}cm 여유`;
}

/** 여유가 아주 빠듯할 때만 강조한다 */
export function isTightFit(clearance: number): boolean {
  return clearance <= TIGHT_FIT_CM;
}

function formatClearance(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * 사용자가 치수를 실제로 좁혔는지.
 * 기본값 그대로면 "최소 100cm 여유" 같은 쓸모없는 문구를 보여주지 않는다.
 */
export function isSizeFilterActive(
  current: DimensionTriple,
  defaults: DimensionTriple,
): boolean {
  return (
    current.maxWidth !== defaults.maxWidth ||
    current.maxDepth !== defaults.maxDepth ||
    current.maxHeight !== defaults.maxHeight
  );
}

/**
 * 숫자 입력칸의 원문을 확정값으로 바꾼다.
 * 빈칸이나 숫자가 아니면 null 을 돌려주고, 호출한 쪽이 이전 값을 유지한다.
 * 입력 도중에는 부르지 않는다. blur / Enter 에서만 확정한다.
 */
export function normalizeDimensionInput(
  raw: string,
  min: number,
  max: number,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return clampDimension(parsed, min, max);
}

/** 범위를 벗어난 값을 경계로 끌어당긴다 */
export function clampDimension(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
