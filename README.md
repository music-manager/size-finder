# 공간핏 (size-finder)

**내 원룸 맞춤 가전·가구 실측 검색기**

원룸·자취방의 빈 공간 치수(가로 W / 깊이 D / 높이 H)를 입력하면, **실제로 그 공간에 들어가는 제품만** 남겨주는 웹앱입니다.

- Next.js 14 (App Router) + TypeScript + Tailwind CSS + lucide-react
- 데이터는 `src/data/products.json` 로컬 JSON (서버/DB 불필요)
- 쿠팡 파트너스 아웃바운드 링크 + 필수 고지 문구 포함

---

## 1. 실행 방법

```bash
npm install
npm run dev     # http://localhost:3000
```

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run typecheck` | 타입 검사 |

배포는 Vercel에 저장소를 연결하면 추가 설정 없이 그대로 올라갑니다.

---

## 2. 폴더 구조

```
src/
├─ app/
│  ├─ layout.tsx        # 메타데이터/SEO, Pretendard 폰트
│  ├─ page.tsx          # 홈 (JSON-LD 구조화 데이터 포함)
│  ├─ globals.css       # Tailwind + 슬라이더 스타일
│  ├─ robots.ts
│  └─ sitemap.ts
├─ components/
│  ├─ Header.tsx               # 상단 브랜딩 배너 (sticky)
│  ├─ SizeFinderApp.tsx        # 필터 상태 관리 (클라이언트 루트)
│  ├─ CategoryTabs.tsx         # 카테고리 칩 + 실시간 개수 뱃지
│  ├─ FilterPanel.tsx          # 검색 + 3축 치수 필터 + 초기화
│  ├─ DimensionSlider.tsx      # 슬라이더 ↔ 숫자 입력 동기화
│  ├─ SearchBar.tsx
│  ├─ MobileFilterDrawer.tsx   # 모바일 하단 고정 버튼 + 드로어
│  ├─ ProductGrid.tsx          # 2~4단 반응형 그리드
│  ├─ ProductCard.tsx          # W×D×H 강조 + 쿠팡 CTA
│  ├─ EmptyState.tsx           # 결과 없음 + 초기화 버튼
│  └─ Footer.tsx               # 쿠팡 파트너스 고지
├─ data/products.json          # 제품 데이터 (20개)
└─ lib/
   ├─ types.ts                 # Product / Filters 타입
   ├─ categories.ts            # 탭 ↔ 카테고리 매핑
   └─ products.ts              # 필터 로직, 슬라이더 범위 자동 계산
```

---

## 3. 제품 추가하기

`src/data/products.json` 배열에 아래 형식으로 넣으면 끝입니다. 슬라이더 최대값과 카테고리 개수 뱃지는 데이터에서 자동 계산되므로 코드 수정이 필요 없습니다.

```json
{
  "id": "ref-006",
  "name": "브랜드 모델명 용량",
  "category": "refrigerator",
  "brand": "브랜드",
  "dimensions": { "width": 47.4, "depth": 49.5, "height": 85.5 },
  "capacity_or_spec": "86L",
  "imageUrl": "https://images.unsplash.com/...",
  "coupangUrl": "https://link.coupang.com/a/본인파트너스코드",
  "tags": ["로켓배송", "가성비", "저소음"]
}
```

`category` 는 다음 5개만 허용됩니다.
`refrigerator` · `washing_machine` · `microwave` · `desk` · `shelf`

> 탭에서 **책상/선반** 은 `desk` 와 `shelf` 를 함께 보여줍니다. (`src/lib/categories.ts` 의 `CATEGORY_MATCH`)

---

## 4. 쿠팡 파트너스 연동

1. 현재 `coupangUrl` 은 **쿠팡 검색 URL** 로 채워져 있어 바로 동작합니다.
2. 수익화하려면 쿠팡 파트너스에서 상품별 파트너스 딥링크(`https://link.coupang.com/a/...`)를 발급받아 각 항목의 `coupangUrl` 만 교체하세요.
3. 모든 CTA 는 `target="_blank"` + `rel="noopener noreferrer sponsored"` 로 출력되어 검색엔진 정책을 준수합니다.
4. 푸터 고지 문구는 정책상 필수이며 `src/components/Footer.tsx` 에 항상 노출됩니다.

> 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.

---

## 5. 배포 전 체크리스트

- [ ] `src/app/layout.tsx`, `robots.ts`, `sitemap.ts` 의 `size-finder.example.com` 을 실제 도메인으로 변경
- [ ] `coupangUrl` 을 본인 파트너스 딥링크로 교체
- [ ] `imageUrl` 을 실제 제품 이미지(또는 자체 호스팅 이미지)로 교체
- [ ] 제품 치수를 제조사 공식 스펙과 재확인
