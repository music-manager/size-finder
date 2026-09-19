import LogoMark from './LogoMark';
import MeasureGuide from './MeasureGuide';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <LogoMark className="h-10 w-10 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5 text-base font-extrabold leading-tight text-slate-900 sm:text-lg">
            센치픽
            <span className="text-[11px] font-bold text-brand-600 sm:text-xs">
              CmPick
            </span>
          </p>
          <p className="truncate text-[11px] leading-tight text-slate-500 sm:text-xs">
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
