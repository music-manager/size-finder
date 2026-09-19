# 센치픽 (CmPick) — 작업 규칙

원룸·자취방 빈 공간의 가로·깊이·높이로 들어가는 가전·가구를 찾아주는 사이트.
쿠팡 파트너스 제휴 수익 모델.

- 서비스: https://cmpick.esedy.com
- Netlify 프로젝트: `esedy-cmpick` (팀: ktntopia's team)

---

## 배포 규칙 (중요)

**배포는 사용자가 승인할 때만 한다.** Netlify 무료 플랜의 빌드 시간(월 300분)을
`lifetools-korea` 와 나눠 쓰므로, 변경 1건마다 배포하지 않는다.

| 브랜치 | 역할 | 배포 |
| --- | --- | --- |
| `claude/compassionate-planck-0onxi1` | 작업 브랜치 | ❌ 안 됨 |
| `main` | 운영 브랜치 | ✅ Netlify 자동 배포 |

**따라서:**

1. 평소 작업은 **작업 브랜치에만** 커밋·푸시한다. (배포 안 일어남)
2. 사용자가 **"배포해"** 라고 할 때만 `main` 에 푸시한다.
3. 매번 **배포 대기 중인 변경 목록**을 사용자에게 알려준다.

---

## 데이터 규칙

제품 데이터는 `src/data/products.json` 한 파일에 있다. 43건.

```jsonc
{
  "id": "dry-006",                    // 카테고리 접두어 3글자 + 일련번호
  "name": "미닉스 미니 건조기 PRO+ 3.5kg",
  "category": "dryer",                // 8종 중 하나 (src/lib/types.ts)
  "brand": "미닉스",
  "dimensions": { "width": 49, "depth": 41.8, "height": 63.1 },  // cm
  "capacity_or_spec": "최대 3.5kg / 표준 2.5kg · MNMD-120G",
  "imageUrl": "https://thumbnail10.coupangcdn.com/...",           // 빈 문자열이면 미표시
  "coupangUrl": "https://link.coupang.com/a/haKLrWKw0q",
  "tags": ["초소형", "설치불필요", "1인가구"],
  "verified": true                    // 제조사 스펙으로 치수 확인 시 true
}
```

**`verified` 는 제조사·상세페이지 스펙으로 치수를 직접 확인한 경우에만 true.**
true 인 제품만 카드에 `✓ 스펙 확인` 뱃지가 붙는다. 추정값에 true 를 달지 않는다.
이 사이트의 가치는 치수 정확성이므로, 링크보다 치수가 우선이다.

**`coupangUrl` 형식:** 반드시 `https://link.coupang.com/a/...` (상품 링크).
`https://coupa.ng/...` 는 iframe 배너용이라 쓰지 않는다.

**쿠팡 썸네일:** URL 경로의 `212x212ex` 를 `492x492ex` 로 바꿔 해상도를 올린다.

---

## 검증 규칙

푸시 전에 항상 통과시킨다.

```bash
npm run lint
npm run build
```

UI 를 건드렸으면 실제 브라우저로 확인한다. 딥링크(`/?c=dryer&w=60`) 복원,
쿠팡 CTA 의 `rel="noopener noreferrer sponsored"`, 모바일 드로어가 회귀 지점이다.

---

## 하지 말 것

- 제품과 무관한 스톡 이미지를 `imageUrl` 에 넣지 않는다. (신뢰도 훼손)
- 확인하지 않은 치수에 `verified: true` 를 달지 않는다.
- `Referrer-Policy` 를 `strict-origin-when-cross-origin` 보다 엄격하게 바꾸지 않는다.
  (쿠팡 파트너스 추적이 깨진다 — `netlify.toml` 참고)
