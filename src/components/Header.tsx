import LogoMark from './LogoMark';
import MeasureGuide from './MeasureGuide';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
        <LogoMark className="h-12 w-12 shrink-0 text-brand-600 sm:h-[52px] sm:w-[52px]" />
        <div className="min-w-0">
          {/* 센치픽이 첫 1초에 읽히도록 워드마크처럼 키우고 '픽'에만 브랜드 색을 준다 */}
          <p className="flex items-baseline gap-1.5 leading-none">
            <span className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-[22px]">
              센치<span className="text-brand-600">픽</span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-brand-500 sm:text-xs">
              CmPick
            </span>
          </p>
          <p className="mt-0.5 truncate text-[12px] font-semibold leading-tight text-slate-700 sm:text-[13px]">
            내 원룸 맞춤 가전·가구 실측 검색기
          </p>
        </div>
        <div className="ml-auto">
          <MeasureGuide />
        </div>
      </div>
    </header>
  );
}
