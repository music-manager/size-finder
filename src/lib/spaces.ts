/**
 * "공간별 빠른 찾기" 항목 정의.
 *
 * 각 항목은 카테고리만 바꾼다. 사용자가 히어로에 넣은 가로·깊이·높이는
 * 그대로 둔다. "이 자리는 폭 40cm" 같은 근거 없는 숫자를 대신 넣지 않는다.
 *
 * 아이콘은 컴포넌트에서 붙인다. 이 파일은 데이터만 두어 그대로 테스트한다.
 */
import type { CategoryId, TabId } from './types';

export interface SpaceItem {
  id: string;
  label: string;
  /** 이 공간이 한 카테고리로 정확히 떨어질 때 */
  category?: TabId;
  /** 한 제품군으로 단정할 수 없어 사용자에게 물어볼 때 */
  choices?: CategoryId[];
}

export const SPACE_ITEMS: SpaceItem[] = [
  { id: 'fridge', label: '냉장고 자리', category: 'refrigerator' },
  { id: 'laundry', label: '세탁실', category: 'washing_machine' },
  { id: 'bedside', label: '침대 옆 틈새', category: 'niche' },
  // 좁은 주방은 전자레인지장인지 식기세척기인지 알 수 없어 한쪽으로 단정하지 않는다
  { id: 'kitchen', label: '좁은 주방', choices: ['microwave', 'dishwasher'] },
  { id: 'desk', label: '책상 자리', category: 'desk' },
  { id: 'entrance', label: '현관', category: 'shoe_rack' },
];

/** 현재 카테고리가 이 항목을 가리키고 있는지 */
export function isSpaceActive(item: SpaceItem, category: TabId): boolean {
  if (item.category) return item.category === category;
  return (item.choices ?? []).some((choice) => choice === category);
}

/**
 * 항목을 눌렀을 때 곧바로 적용할 카테고리.
 * 고를 것이 여러 개면 null 이고, 컴포넌트가 선택지를 펼친다.
 */
export function resolveSpaceCategory(item: SpaceItem): TabId | null {
  return item.category ?? null;
}
