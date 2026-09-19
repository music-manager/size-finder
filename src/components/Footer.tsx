export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm font-bold text-slate-900">
          공간핏 — 내 원룸 맞춤 가전·가구 실측 검색기
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          제품 치수는 제조사 공개 스펙 기준이며, 문고리·배관·걸레받이 등 설치
          환경에 따라 실제 필요 공간이 달라질 수 있습니다. 구매 전 실측 후 최소
          2~5cm 여유를 두고 확인하세요.
        </p>
        <div className="mt-6 rounded-xl bg-slate-100 px-4 py-3">
          <p className="text-xs leading-relaxed text-slate-600">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
            수수료를 제공받습니다.
          </p>
        </div>
        <p className="mt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} 공간핏. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
