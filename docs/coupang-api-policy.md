# 쿠팡 파트너스 API 공용 quota 안전정책

> **이 저장소는 쿠팡 Search API 를 직접 호출하지 않는다.**
> 호출 권한은 공용 Coordinator 한 곳에만 있다.

## 왜 이렇게 하나

센치픽·차종픽·꿀템픽 세 사이트가 **같은 쿠팡 파트너스 계정 하나**를 쓴다.
각 사이트가 알아서 Search API 를 부르면 같은 시간대에 세 배로 부르게 되고,
시간당 한도를 넘겨 계정이 막힌다. 실제로 한 번 막혔다.

상품이 늦게 올라오는 것은 괜찮다. 계정이 막히면 세 사이트가 전부 멈춘다.

**우선순위:** ① 계정 안전 → ② quota 안전 → ③ 데이터 정확성 → ④ 시스템 안정성 → ⑤ 수집 속도

## 구조

```
센치픽 ─────┐
            │
차종픽 ─────┼──> 공용 Coupang API Coordinator ──> 쿠팡 Search API
            │      ├─ global quota
꿀템픽 ─────┘      ├─ request queue
                   ├─ rolling ledger
                   ├─ cache
                   ├─ circuit breaker
                   └─ HMAC signing
```

API 키를 나눠 쓰는 게 아니라 **Coordinator 를 나눠 쓴다.**

## 한도 — 세 프로젝트 합산

| 항목 | 값 | 비고 |
| --- | --- | --- |
| `NORMAL_LIMIT` | rolling 60분 **3회** | 평상시 상한 |
| `HARD_LIMIT` | rolling 60분 **4회** | 절대 상한 |
| `MIN_INTERVAL` | **21분** | 호출과 호출 사이 최소 간격 |
| `DAILY_LIMIT` | rolling 24시간 **36회** | |
| Search `limit` | **1~10** | 1회 응답 건수 |

**프로젝트별 한도가 아니다.** 센치픽 1회 + 차종픽 1회 + 꿀템픽 1회 = 합계 3회다.

간격 예시: `07:00 센치픽` → `07:21 차종픽` → `07:42 꿀템픽`.
21분 안에 다른 프로젝트 요청이 와도 바로 부르지 않고 큐에서 기다린다.

## rolling 기준

시계의 "정시"가 아니라 **rolling 60분**으로 센다.
`07:10 / 07:31 / 07:52` 에 3회 썼다면 `08:10` 전까지 첫 슬롯이 살아 있다.
현재 시(hour)만 보고 0으로 되돌리는 방식은 쓰지 않는다.

## quota 계산 기준

**응답 성공 여부가 아니라 "요청 시도"가 기준이다.**
`200` / `400` / `401` / `403` / `429` / `500` / timeout / 파싱 실패 — 전부 1회로 센다.

슬롯을 예약한 뒤 워커가 죽어도 그 슬롯은 **쓴 것으로 남긴다. 자동 환불 없음.**
과대계산은 괜찮고 과소계산은 안 된다.

## 슬롯 예약 순서

```
DB transaction 시작
  → global lock
  → circuit breaker 확인
  → rolling 60분 quota 확인
  → rolling 24시간 quota 확인
  → last_sent_at 확인
  → slot reservation INSERT
COMMIT
  → 실제 쿠팡 HTTP 요청
```

**반대 순서(먼저 호출하고 나중에 기록)는 금지한다.**

## 오류 처리

- **재시도 0회.** 자동 retry 를 만들지 않는다.
- `400` `401` `403` `429` `5xx` timeout 예상 밖 응답 — **첫 오류에서 즉시 중단.**
  다음 키워드로 넘어가지 않는다.
- `403` 응답에 rate limit / hourly / 시간당 사용 횟수 / 호출 제한 관련 메시지가 있으면
  **GLOBAL circuit breaker OPEN.** 그 순간부터 세 사이트 모두 호출 0회.
  `blocked_until` 저장, **최소 24시간.** 응답에 retry-after 가 있고 그게 더 길면 긴 쪽을 쓴다.

## fail-closed

다음 상황에서는 **호출하지 않는다.** fail-open 은 금지한다.

- Coordinator DB 접속 실패
- quota 확인 실패
- ledger 상태 불명
- lock 실패
- cache DB 오류
- circuit breaker 상태 확인 불가

## 캐시와 raw 응답 보존

- 검색 캐시 **최소 24시간** (상황에 따라 24~72시간). 캐시에 있으면 호출 0회.
- 1회 호출로 받은 최대 10건의 **raw 응답을 그대로 보존**한다.
- `products` / `pending` / 후보 / 호환성 / 치수 / 대체상품 분류는 **로컬에서** 한다.
- 필터가 바뀌었다는 이유로 같은 키워드를 다시 부르지 않는다.

## 큐와 공정성

각 사이트는 호출 대신 잡을 넣는다.

```json
{ "project": "cmpick", "keyword": "원룸 미니 냉장고" }
```

큐는 round-robin 으로 돈다: 센치픽 → 차종픽 → 꿀템픽. 큐가 빈 프로젝트는 건너뛴다.
한 사이트가 quota 를 독점하지 않는다.

## Secret

`COUPANG_ACCESS_KEY` 와 `COUPANG_SECRET_KEY` 는 **Coordinator 실행환경 한 곳에만** 둔다.

이 저장소에서 금지하는 것:

- `.env` 에 운영 키 저장
- GitHub Actions Secret 등록
- 소스코드 하드코딩
- 로그 출력
- README 예시값에 실제 값 삽입

이 문서처럼 정책을 설명하려고 **이름을 언급하는 것은 허용**한다.
금지 대상은 실행 코드에서 값을 읽어 쓰는 것이다.

## Coordinator DB 계약 (향후)

이 저장소에 migration 을 만들지 않는다. Coordinator 가 쓸 스키마만 적어 둔다.

### `coupang_api_calls`

| 필드 | 설명 |
| --- | --- |
| `id` | PK |
| `request_id` | 요청 식별자 |
| `project` | `cmpick` / `vehicle-fit-finder` / `kkultem-pick` |
| `keyword` | 검색어 |
| `keyword_hash` | 캐시 키 |
| `reserved_at` | 슬롯 예약 시각 (quota 기준 시각) |
| `sent_at` | 실제 요청 시각 |
| `finished_at` | 응답 수신 시각 |
| `http_status` | 응답 코드 |
| `result` | 처리 결과 |
| `error_type` | 오류 분류 |
| `created_at` | |

### `coupang_api_control`

| 필드 | 설명 |
| --- | --- |
| `api_type` | API 종류 (search 등) |
| `blocked_until` | circuit breaker 해제 시각 |
| `blocked_reason` | 차단 사유 |
| `last_sent_at` | `MIN_INTERVAL` 계산용 |
| `updated_at` | |

### `coupang_api_queue`

| 필드 | 설명 |
| --- | --- |
| `id` | PK |
| `project` | 요청한 사이트 |
| `keyword` | 검색어 |
| `priority` | 우선순위 |
| `status` | `pending` / `sent` / `done` / `failed` |
| `created_at` | |
| `available_at` | 이 시각 이후에만 처리 |

## 이 저장소의 현재 상태 (Foundation)

- 쿠팡 production API **직접 호출 코드 없음.** HMAC 서명 코드 없음.
- 실행 코드·Actions 에서 `COUPANG_ACCESS_KEY` / `COUPANG_SECRET_KEY` **사용 없음.**
- 쿠팡 수집 **자동 schedule 없음.** 수집용 workflow 자체가 없다.
- `scripts/coordinator/client.mjs` 는 **mock 구현만** 동작한다.
  `COUPANG_COORDINATOR_MODE=live` 와 `ALLOW_COUPANG_LIVE=true` 를 둘 다 줘도
  live 경로는 `LiveModeBlockedError` 로 막힌다 (Coordinator 가 아직 없으므로).
- Foundation 단계 **실제 API 호출 0회.**
- 위 항목들은 `scripts/sync.test.mjs` 가 매 테스트에서 검사한다.
  누가 직접 호출 코드를 되살리면 테스트가 깨진다.

## 앞으로 하면 안 되는 것

```js
fetch('https://api-gateway.coupang.com/...')   // ✗
axios.get(coupangSearchApi)                    // ✗
crypto.createHmac('sha256', COUPANG_SECRET_KEY) // ✗
```

사이트 코드는 Coordinator 클라이언트만 쓴다.

```js
import { createCoordinatorClient } from './coordinator/client.mjs';

const client = createCoordinatorClient();
const { status, products, quota } = await client.searchProducts({
  keyword: '원룸 미니 냉장고',
  category: 'refrigerator',
});
// quota.actualApiCalled === false
```
