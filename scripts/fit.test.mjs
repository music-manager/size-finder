/**
 * 히어로 치수 입력과 "얼마나 여유 있게 들어가는지" 계산 테스트.
 *
 * 브라우저도 DOM 도 쓰지 않는다. src/lib 의 순수 함수만 부른다.
 * (Node 22.18+ 의 타입 스트리핑으로 .ts 를 그대로 불러온다 — 새 의존성 없음)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import {
  MIN_DIMENSION_BOUNDS,
  TIGHT_FIT_CM,
  clampDimension,
  exceedsDimensionLimit,
  resolveDimensionBounds,
  fitClearance,
  fitLabel,
  isSizeFilterActive,
  isTightFit,
  normalizeDimensionInput,
} from '../src/lib/fit.ts';

// 실제 앱의 기본값과 같은 모양 (products.json 을 읽지 않고 형태만 맞춘다)
const DEFAULTS = { maxWidth: 200, maxDepth: 100, maxHeight: 210 };
const DIM_MIN = 10;

describe('치수 입력 정규화', () => {
  it('평범한 숫자를 그대로 받는다', () => {
    assert.equal(normalizeDimensionInput('60', DIM_MIN, 200), 60);
    assert.equal(normalizeDimensionInput(' 75 ', DIM_MIN, 200), 75);
  });

  it('빈칸이면 null 이라 호출한 쪽이 직전 값을 유지한다', () => {
    assert.equal(normalizeDimensionInput('', DIM_MIN, 200), null);
    assert.equal(normalizeDimensionInput('   ', DIM_MIN, 200), null);
  });

  it('숫자가 아니면 null 이다 (NaN 이 필터로 새지 않는다)', () => {
    for (const raw of ['abc', '--', '1.2.3', 'e5']) {
      assert.equal(normalizeDimensionInput(raw, DIM_MIN, 200), null, raw);
    }
  });

  it('범위를 벗어나면 경계로 끌어당긴다', () => {
    assert.equal(normalizeDimensionInput('1', DIM_MIN, 200), DIM_MIN);
    assert.equal(normalizeDimensionInput('9999', DIM_MIN, 200), 200);
    assert.equal(normalizeDimensionInput('-40', DIM_MIN, 200), DIM_MIN);
  });

  it('소수는 반올림한다', () => {
    assert.equal(normalizeDimensionInput('59.6', DIM_MIN, 200), 60);
    assert.equal(normalizeDimensionInput('59.4', DIM_MIN, 200), 59);
  });

  it('clampDimension 은 유한하지 않은 값도 버티고 최소값을 준다', () => {
    assert.equal(clampDimension(Number.NaN, DIM_MIN, 200), DIM_MIN);
    assert.equal(clampDimension(Infinity, DIM_MIN, 200), DIM_MIN);
    assert.equal(clampDimension(50, DIM_MIN, 200), 50);
  });
});

describe('치수 필터 활성 판정', () => {
  it('기본값 그대로면 꺼져 있다', () => {
    assert.equal(isSizeFilterActive({ ...DEFAULTS }, DEFAULTS), false);
  });

  it('한 축만 좁혀도 켜진다', () => {
    assert.equal(isSizeFilterActive({ ...DEFAULTS, maxWidth: 60 }, DEFAULTS), true);
    assert.equal(isSizeFilterActive({ ...DEFAULTS, maxDepth: 45 }, DEFAULTS), true);
    assert.equal(isSizeFilterActive({ ...DEFAULTS, maxHeight: 90 }, DEFAULTS), true);
  });
});

describe('여유 공간 계산', () => {
  const product = { width: 50, depth: 45, height: 85 };

  it('세 축 중 가장 빠듯한 여유를 돌려준다', () => {
    // 가로 10 / 깊이 5 / 높이 15 → 가장 작은 5
    const clearance = fitClearance({
      ...product,
      maxWidth: 60,
      maxDepth: 50,
      maxHeight: 100,
    });
    assert.equal(clearance, 5);
  });

  it('한 축이라도 들어가지 않으면 null 이다', () => {
    assert.equal(
      fitClearance({ ...product, maxWidth: 40, maxDepth: 50, maxHeight: 100 }),
      null,
      '가로가 넘친다',
    );
    assert.equal(
      fitClearance({ ...product, maxWidth: 60, maxDepth: 30, maxHeight: 100 }),
      null,
      '깊이가 넘친다',
    );
    assert.equal(
      fitClearance({ ...product, maxWidth: 60, maxDepth: 50, maxHeight: 80 }),
      null,
      '높이가 넘친다',
    );
  });

  it('음수 여유는 배지로 내보내지 않는다', () => {
    const clearance = fitClearance({
      ...product,
      maxWidth: 49,
      maxDepth: 50,
      maxHeight: 100,
    });
    assert.equal(clearance, null);
  });

  it('0.05cm 오차는 딱 맞는 것으로 본다 (filterProducts 와 같은 기준)', () => {
    const clearance = fitClearance({
      width: 50.02,
      depth: 45,
      height: 85,
      maxWidth: 50,
      maxDepth: 50,
      maxHeight: 100,
    });
    assert.equal(clearance, 0);
  });

  it('숫자가 아니면 null 이다', () => {
    assert.equal(
      fitClearance({ ...product, maxWidth: Number.NaN, maxDepth: 50, maxHeight: 100 }),
      null,
    );
  });

  it('도어 여유를 켜면 그만큼 깊이가 더 필요하다', () => {
    const DOOR_CLEARANCE_CM = 30;
    const withoutDoor = fitClearance({
      ...product,
      maxWidth: 60,
      maxDepth: 80,
      maxHeight: 100,
    });
    const withDoor = fitClearance({
      ...product,
      depth: product.depth + DOOR_CLEARANCE_CM,
      maxWidth: 60,
      maxDepth: 80,
      maxHeight: 100,
    });

    assert.equal(withoutDoor, 10, '가로 10 이 가장 빠듯하다');
    assert.equal(withDoor, 5, '깊이가 75 가 되어 여유 5 로 줄어든다');
  });

  it('도어 여유 때문에 안 들어가면 배지를 숨긴다', () => {
    const clearance = fitClearance({
      ...product,
      depth: product.depth + 30,
      maxWidth: 60,
      maxDepth: 50,
      maxHeight: 100,
    });
    assert.equal(clearance, null);
  });
});

describe('여유 문구', () => {
  it('아주 빠듯하면 딱 맞음이다', () => {
    assert.equal(fitLabel(0), '딱 맞음');
    assert.equal(fitLabel(TIGHT_FIT_CM), '딱 맞음');
    assert.equal(isTightFit(TIGHT_FIT_CM), true);
  });

  it('여유가 있으면 최소 여유를 cm 로 알려준다', () => {
    assert.equal(fitLabel(7), '최소 7cm 여유');
    assert.equal(fitLabel(12.5), '최소 12.5cm 여유');
    assert.equal(isTightFit(7), false);
  });

  it('소수점은 한 자리까지만 보여준다', () => {
    assert.equal(fitLabel(9.24), '최소 9.2cm 여유');
    assert.equal(fitLabel(9.0), '최소 9cm 여유');
  });
});

// ── 공간별 빠른 찾기 ──────────────────────────────────────────────────────
const { SPACE_ITEMS, isSpaceActive, resolveSpaceCategory } = await import(
  '../src/lib/spaces.ts'
);

describe('공간별 빠른 찾기', () => {
  it('여섯 개 공간이 정해진 순서로 있다', () => {
    assert.deepEqual(
      SPACE_ITEMS.map((item) => item.label),
      ['냉장고 자리', '세탁실', '침대 옆 틈새', '좁은 주방', '책상 자리', '현관'],
    );
  });

  it('공간 이름이 맞는 카테고리로 이어진다', () => {
    const byId = Object.fromEntries(SPACE_ITEMS.map((item) => [item.id, item]));
    assert.equal(resolveSpaceCategory(byId.fridge), 'refrigerator');
    assert.equal(resolveSpaceCategory(byId.laundry), 'washing_machine');
    assert.equal(resolveSpaceCategory(byId.bedside), 'niche');
    assert.equal(resolveSpaceCategory(byId.desk), 'desk');
    assert.equal(resolveSpaceCategory(byId.entrance), 'shoe_rack');
  });

  it('좁은 주방은 한쪽으로 단정하지 않고 물어본다', () => {
    const kitchen = SPACE_ITEMS.find((item) => item.id === 'kitchen');
    assert.equal(resolveSpaceCategory(kitchen), null, '바로 카테고리를 정하지 않는다');
    assert.deepEqual(kitchen.choices, ['microwave', 'dishwasher']);
  });

  it('어떤 항목도 치수를 대신 정하지 않는다', () => {
    for (const item of SPACE_ITEMS) {
      for (const key of ['maxWidth', 'maxDepth', 'maxHeight']) {
        assert.equal(
          item[key],
          undefined,
          `${item.label} 이 근거 없는 ${key} 를 넣고 있다`,
        );
      }
    }
  });

  it('현재 카테고리에 맞는 항목만 활성으로 본다', () => {
    const byId = Object.fromEntries(SPACE_ITEMS.map((item) => [item.id, item]));
    assert.equal(isSpaceActive(byId.fridge, 'refrigerator'), true);
    assert.equal(isSpaceActive(byId.fridge, 'desk'), false);
    // 선택지를 가진 항목은 그중 하나가 골라져 있으면 활성이다
    assert.equal(isSpaceActive(byId.kitchen, 'microwave'), true);
    assert.equal(isSpaceActive(byId.kitchen, 'dishwasher'), true);
    assert.equal(isSpaceActive(byId.kitchen, 'all'), false);
  });
});

describe('치수 최대값 — seed 3개(70×70×80)에 묶이지 않는다', () => {
  // 현재 seed 실측 카드(건조기 3개)로 계산되는 값
  const SEED_ONLY = { width: 70, depth: 70, height: 80 };
  const BOUNDS = resolveDimensionBounds(SEED_ONLY);

  it('최대값은 하한 200×230×230 이상이고, seed 최대치가 더 크면 그 값을 쓴다', () => {
    assert.deepEqual(BOUNDS, { width: 200, depth: 230, height: 230 });
    assert.deepEqual(resolveDimensionBounds({ width: 260, depth: 90, height: 240 }), { width: 260, depth: 230, height: 240 });
    assert.deepEqual(MIN_DIMENSION_BOUNDS, { width: 200, depth: 230, height: 230 });
  });

  it('130×70×190 입력이 잘리지 않고 그대로 확정되며, 기본값과 달라 공간 맞춤이 켜진다', () => {
    const typed = [
      normalizeDimensionInput('130', DIM_MIN, BOUNDS.width),
      normalizeDimensionInput('70', DIM_MIN, BOUNDS.depth),
      normalizeDimensionInput('190', DIM_MIN, BOUNDS.height),
    ];
    assert.deepEqual(typed, [130, 70, 190]);
    const defaults = { maxWidth: BOUNDS.width, maxDepth: BOUNDS.depth, maxHeight: BOUNDS.height };
    assert.equal(isSizeFilterActive({ maxWidth: 130, maxDepth: 70, maxHeight: 190 }, defaults), true);
    // 예전 버그: 최대값이 70×70×80 이면 130·190 이 잘려 기본값과 같아지고 맞춤이 꺼졌다
    const seedDefaults = { maxWidth: 70, maxDepth: 70, maxHeight: 80 };
    const clipped = { maxWidth: clampDimension(130, DIM_MIN, 70), maxDepth: clampDimension(70, DIM_MIN, 70), maxHeight: clampDimension(190, DIM_MIN, 80) };
    assert.equal(isSizeFilterActive(clipped, seedDefaults), false);
  });

  it('한도가 최대값이면 그 축은 제한 없음 — 기본 상태에서 큰 DB 상품도 보인다', () => {
    assert.equal(exceedsDimensionLimit(250, BOUNDS.height, BOUNDS.height), false);
    assert.equal(exceedsDimensionLimit(123, 190, BOUNDS.height), false);
    assert.equal(exceedsDimensionLimit(190.04, 190, BOUNDS.height), false, '0.05cm 허용');
    assert.equal(exceedsDimensionLimit(191, 190, BOUNDS.height), true);
    assert.equal(exceedsDimensionLimit(71, 70, BOUNDS.depth), true);
  });

  it('products.ts 는 하한이 적용된 최대값과 제한 없음 판정으로 거른다', () => {
    const src = readFileSync(new URL('../src/lib/products.ts', import.meta.url), 'utf8');
    assert.match(src, /export const DIMENSION_BOUNDS: DimensionBounds = resolveDimensionBounds\(/);
    for (const axis of ['width', 'depth', 'height']) {
      assert.match(src, new RegExp(`exceedsDimensionLimit\\(${axis}, filters\\.max\\w+, DIMENSION_BOUNDS\\.${axis}, EPSILON\\)`));
    }
    assert.doesNotMatch(src, /width > filters\.maxWidth/);
  });
});
