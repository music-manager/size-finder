/**
 * 카테고리별 수집 키워드.
 * 쿠팡 검색 결과가 카테고리마다 다르므로, 키워드에 카테고리를 직접 붙여
 * 자동 분류 실패로 엉뚱한 탭에 들어가는 일을 막는다.
 */
export const KEYWORD_GROUPS = [
  {
    category: 'refrigerator',
    keywords: [
      '소형 냉장고',
      '원룸 미니 냉장고',
      '1도어 냉장고',
      '2도어 소형 냉장고',
      '슬림 냉장고 100L',
      '미니 음료 냉장고',
    ],
  },
  {
    category: 'washing_machine',
    keywords: [
      '원룸 미니 세탁기',
      '소형 통돌이 세탁기 3kg',
      '벽걸이 세탁기',
      '아기옷 미니세탁기 5kg',
      '컴팩트 세탁기',
    ],
  },
  {
    category: 'dryer',
    keywords: [
      '미니 건조기 3kg',
      '소형 의류건조기',
      '무설치 건조기',
      '원룸 건조기',
      '미닉스 건조기',
      '위닉스 컴팩트 건조기',
    ],
  },
  {
    category: 'dishwasher',
    keywords: [
      '무설치 식기세척기',
      '카운터탑 식기세척기',
      '1인용 식기세척기',
      '미니 식기세척기 3인용',
      '싱크대 상판 식기세척기',
    ],
  },
  {
    category: 'microwave',
    keywords: [
      '슬림 전자레인지',
      '원룸 소형 전자레인지 15L',
      '1~2인용 미니 밥솥',
      '슬림 렌지대',
      '원룸 전자레인지 수납장',
      '폭 40cm 렌지대',
      '밥솥 렌지대',
    ],
  },
  {
    category: 'niche',
    keywords: [
      '틈새 수납장 15cm',
      '틈새 수납장 20cm',
      '슬림 틈새장 25cm',
      '이동식 3단 트롤리',
      '냉장고 틈새 선반',
      '세탁기 틈새 수납',
      '미니 멀티 수납장',
      '폭 15cm 수납장',
    ],
  },
  {
    category: 'desk',
    keywords: [
      '원룸 컴퓨터 책상 800',
      '폭 40cm 슬림 책상',
      '1인용 미니 책상 600',
      '벽선반 책상',
      '폭 1000 책상',
    ],
  },
  {
    category: 'shelf',
    keywords: [
      '슬림 5단 철제 선반',
      '깊이 30cm 책장',
      '깊이 40cm 선반',
      '높이 120cm 이하 수납장',
    ],
  },
  {
    category: 'folding_table',
    keywords: [
      '접이식 좌식 테이블',
      '원룸 접이식 밥상',
      '베드 트레이',
      '접이식 책상 슬림',
    ],
  },
  {
    category: 'bed',
    keywords: [
      '싱글 침대 프레임 SS',
      '헤드리스 침대',
      '수납형 싱글 침대',
      '원룸 접이식 매트리스',
      '슬림 데이베드',
    ],
  },
  {
    category: 'hanger',
    keywords: [
      '슬림 드레스룸 행거 800',
      '1단 미니 행거',
      '커튼형 슬림 옷장',
      '코너형 행거',
      '폭 40cm 이동식 행거',
      '폭 1000 행거',
    ],
  },
  {
    category: 'shoe_rack',
    keywords: [
      '슬림 플랩 도어 신발장',
      '현관 틈새 신발장 15cm',
      '원룸 미니 신발 정리대',
    ],
  },
  {
    category: 'sofa',
    keywords: [
      '1인용 리클라이너 소파',
      '미니 2인용 패브릭 소파',
      '원룸 소파베드',
      '접이식 좌식의자',
    ],
  },
];

export const ALL_KEYWORDS = KEYWORD_GROUPS.flatMap((g) =>
  g.keywords.map((keyword) => ({ keyword, category: g.category })),
);
