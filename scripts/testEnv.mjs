/**
 * 테스트 전용 안전장치.
 *
 * coupangApi.mjs 는 모듈을 불러오는 순간 COUPANG_API_HOST 를 읽어 굳힌다.
 * 이 파일을 coupangApi.mjs 보다 먼저 import 해 호스트를 막다른 로컬 주소로
 * 고정해 두면, 테스트가 실수로라도 실제 쿠팡 서버를 부를 수 없다.
 * 각 테스트는 목 서버가 뜬 뒤 캐시를 우회해 다시 import 하며 주소를 바꾼다.
 */
if (!process.env.COUPANG_API_HOST) {
  // 아무도 듣지 않는 포트. 실수로 요청이 나가면 연결 거부로 즉시 드러난다.
  process.env.COUPANG_API_HOST = 'http://127.0.0.1:1';
}
