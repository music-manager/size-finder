/**
 * 개발·테스트 전용 가짜 상품.
 *
 * Coordinator 가 없는 동안 수집 흐름을 돌려보기 위한 것이다.
 * 운영 데이터(src/data/products.json)에 섞이면 안 되므로 모든 항목에
 * isMock 표시가 붙고, id 는 실제 데이터와 겹치지 않는 mock- 접두어를 쓴다.
 * 쿠팡 링크도 실제 제휴 링크가 아니라 example.invalid 를 가리킨다.
 */
export const MOCK_ID_PREFIX = 'mock-';

const item = (n, category, name, dimensions) => ({
  id: `${MOCK_ID_PREFIX}${category}-${String(n).padStart(3, '0')}`,
  name: `[개발용 가짜 상품] ${name}`,
  category,
  brand: '테스트',
  dimensions,
  capacity_or_spec: '개발용 예시 데이터',
  imageUrl: '',
  // 실제 제휴 링크가 아니다. 눌러도 아무 데도 가지 않는다.
  coupangUrl: 'https://example.invalid/mock-product',
  tags: ['개발용'],
  verified: false,
  isMock: true,
});

export const MOCK_CATALOG = [
  item(1, 'refrigerator', '미니 냉장고 A', { width: 47, depth: 49, height: 85 }),
  item(2, 'refrigerator', '미니 냉장고 B', { width: 45, depth: 48, height: 84 }),
  item(3, 'washing_machine', '미니 세탁기 A', { width: 55, depth: 55, height: 80 }),
  item(4, 'dryer', '미니 건조기 A', { width: 49, depth: 42, height: 63 }),
  item(5, 'microwave', '전자레인지 A', { width: 45, depth: 33, height: 26 }),
  item(6, 'desk', '원룸 책상 A', { width: 100, depth: 50, height: 72 }),
  item(7, 'shelf', '선반 A', { width: 60, depth: 30, height: 120 }),
  item(8, 'niche', '틈새 수납장 A', { width: 20, depth: 40, height: 90 }),
  item(9, 'sofa', '1인 소파 A', { width: 80, depth: 75, height: 85 }),
  item(10, 'shoe_rack', '신발장 A', { width: 60, depth: 30, height: 100 }),
];

/** 운영 데이터에 가짜 상품이 섞였는지 본다. */
export function findMockLeaks(items) {
  return (items ?? []).filter(
    (p) => p?.isMock === true || String(p?.id ?? '').startsWith(MOCK_ID_PREFIX),
  );
}
