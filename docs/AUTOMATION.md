# 쿠팡 상품 자동 수집

매일 새벽 5시(KST)에 쿠팡 파트너스 API로 상품을 수집해 센치픽에 반영한다.

## 왜 완전 자동이 아닌가

쿠팡 파트너스 검색 API가 주는 필드는 아래가 전부다.

```
productId, productName, productPrice, productImage,
productUrl(파트너스 딥링크), categoryName, rank, isRocket, isFreeShipping
```

**치수(W×D×H)와 리뷰 수가 없다.** 치수는 센치픽의 존재 이유이므로 추측으로 채우면 안 된다.
상세페이지 크롤링은 쿠팡 약관 위반·IP 차단 위험이 있어 하지 않는다.

그래서 이렇게 나눈다.

| API가 주는 것 | 처리 |
| --- | --- |
| 제목·가격·이미지·딥링크·로켓배송 | 100% 자동 |
| 태그 | 상품명 키워드로 자동 생성 |
| 카테고리 | 검색 키워드에 미리 지정 |
| 인기도 | 리뷰 수 대신 검색 순위(`rank`) 사용 |
| **치수** | **상품명에 있으면 자동, 없으면 대기열 → 사람이 3칸 입력** |

## 흐름

```
GitHub Actions (매일 05:00 KST)
  └ scripts/sync-coupang.mjs
      ├ 키워드 68개 검색 (scripts/keywords.mjs)
      ├ 로켓배송 아님 / 21위 밖 / 이미 있음 제외
      ├ 이미 등록된 상품이면 가격만 갱신
      ├ 상품명에 치수 있음 → src/data/products.json (verified: false)
      └ 치수 없음        → src/data/pending.json (대기열)
  └ lint + build 로 검증
  └ 변경 있으면 main 에 커밋 → Netlify 자동 배포

관리자
  └ /admin → "수집 대기열" 탭 → 가로·깊이·높이 3칸 입력 → 등록 (verified: true)
  └ "전체 JSON 복사" 로 결과 전달
```

## 설정

GitHub 저장소 → Settings → Secrets and variables → Actions 에 두 개를 등록한다.

| Secret | 값 |
| --- | --- |
| `COUPANG_ACCESS_KEY` | 파트너스 → 오픈 API → ACCESS KEY |
| `COUPANG_SECRET_KEY` | 파트너스 → 오픈 API → SECRET KEY |

## 수동 실행

Actions 탭 → "쿠팡 상품 수집" → Run workflow.
`dry_run` 을 켜면 파일을 쓰지 않고 결과만 본다.

로컬에서도 돌릴 수 있다.

```bash
COUPANG_ACCESS_KEY=... COUPANG_SECRET_KEY=... node scripts/sync-coupang.mjs --dry-run
```

## 조절 가능한 값

환경변수로 넘긴다. 워크플로 파일에서 바꾸면 된다.

| 변수 | 기본 | 뜻 |
| --- | --- | --- |
| `SYNC_LIMIT` | 20 | 키워드당 조회 수 |
| `SYNC_MAX_RANK` | 20 | 채택할 검색 순위 상한 |
| `SYNC_ROCKET_ONLY` | true | 로켓배송만 수집 |
| `SYNC_DELAY_MS` | 400 | 호출 간 간격 (API 호출 제한 대응) |

## 키워드 추가

`scripts/keywords.mjs` 의 해당 카테고리에 문자열을 더하면 된다.
카테고리를 키워드에 직접 붙여두므로, 자동 분류 실패로 엉뚱한 탭에 들어가지 않는다.

## 주의

- 수집된 상품의 치수는 **상품명에서 뽑은 값**이라 `verified: false` 다.
  대기열에서 사람이 확인해 넣은 것만 `verified: true` 가 되고 `✓ 스펙 확인` 뱃지가 붙는다.
- 워크플로는 `main` 에 직접 커밋한다. 수집 결과가 마음에 들지 않으면 해당 커밋을 되돌리면 된다.
- API 호출 제한이 있으므로 하루 1회 배치로 설계했다. 주기를 늘리지 말 것.
