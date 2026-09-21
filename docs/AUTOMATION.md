# 쿠팡 상품 수집 자동화 — 중단됨

> 이 문서가 설명하던 "저장소가 직접 쿠팡 Search API 를 호출하는" 방식은
> **더 이상 쓰지 않는다.** 현재 정책은 [`coupang-api-policy.md`](./coupang-api-policy.md) 를 본다.

## 무슨 일이 있었나

센치픽·차종픽·꿀템픽 세 사이트가 같은 쿠팡 파트너스 계정 하나를 쓴다.
각 저장소가 따로 Search API 를 부르니 같은 시간대에 호출이 겹쳤고,
시간당 한도를 넘겨 계정이 차단됐다.

그래서 이 저장소에서 다음을 걷어냈다.

| 제거한 것 | 이유 |
| --- | --- |
| `scripts/coupangApi.mjs` | HMAC 서명 + `api-gateway.coupang.com` 직접 호출 |
| `scripts/sync-coupang.mjs` | 쿠팡 API 직접 호출, `COUPANG_*_KEY` 사용 |
| `.github/workflows/sync-coupang.yml` | Actions Secret 으로 쿠팡 키를 주입 |

## 지금 구조

실제 호출 권한은 **공용 Coordinator** 한 곳에만 있다.
이 저장소는 요청만 넣는 소비자다.

```js
import { createCoordinatorClient } from '../scripts/coordinator/client.mjs';

const client = createCoordinatorClient();
const { status, products, quota } = await client.searchProducts({
  keyword: '원룸 미니 냉장고',
  category: 'refrigerator',
});
// quota.actualApiCalled === false
```

Foundation 단계에서는 Coordinator 가 아직 없어 **mock 구현만** 동작한다.

## GitHub Actions Secret

`COUPANG_ACCESS_KEY` / `COUPANG_SECRET_KEY` 를 **이 저장소에 등록하지 않는다.**
이미 등록돼 있다면 지운다. 키는 Coordinator 실행환경에만 둔다.

> 이 문단은 정책 설명이라 이름을 적었다. 실행 코드에서 이 값을 읽는 것은 금지이며,
> `scripts/foundation.test.mjs` 가 매 테스트에서 확인한다.

## 남아 있는 것

| 파일 | 역할 |
| --- | --- |
| `scripts/keywords.mjs` | 카테고리별 수집 키워드 68개 |
| `scripts/normalize.mjs` | 상품명에서 치수·스펙·브랜드 뽑기 (로컬 처리) |
| `scripts/syncState.mjs` | Coordinator 큐에 넣을 키워드 순서(cursor) |
| `scripts/validate-data.mjs` | 상품 데이터 검증 (`npm run validate`) |
| `scripts/coordinator/` | Coordinator 클라이언트 + 개발용 mock 상품 |

전부 쿠팡 API 를 부르지 않는다.
