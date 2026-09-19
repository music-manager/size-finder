'use client';

import { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

const TIPS = [
  {
    title: '벽에서 벽까지, 가장 좁은 곳을 재세요',
    body: '걸레받이(바닥 몰딩)나 배관이 튀어나와 있으면 그 지점이 실제 한계입니다. 위·중간·아래 세 곳을 재서 가장 작은 값을 쓰세요.',
  },
  {
    title: '들어오는 길도 재야 합니다',
    body: '현관문 폭, 방문 폭, 엘리베이터 입구를 확인하세요. 놓을 자리에는 맞는데 반입이 안 되는 경우가 가장 흔한 실패입니다.',
  },
  {
    title: '문 열 공간을 빼먹지 마세요',
    body: '냉장고·전자레인지·건조기는 문을 열면 앞쪽으로 30cm 정도가 더 필요합니다. 필터의 “도어 개폐 공간 포함”을 켜면 자동으로 반영됩니다.',
  },
  {
    title: '냉장고는 방열 공간이 필요합니다',
    body: '뒤쪽 5cm, 양옆 2cm 정도를 비워야 합니다. 꽉 끼워 넣으면 전기료가 오르고 고장이 빨라집니다.',
  },
  {
    title: '콘센트 위치를 확인하세요',
    body: '가전을 놓을 자리 근처에 콘센트가 있는지, 멀티탭을 써도 되는지(세탁기·건조기는 단독 콘센트 권장) 미리 보세요.',
  },
  {
    title: '실측값에서 2~5cm 빼고 입력하세요',
    body: '딱 맞게 넣으면 설치 기사가 밀어 넣지 못합니다. 이 사이트에 넣는 숫자는 여유를 뺀 값이어야 안전합니다.',
  },
];

export default function MeasureGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">치수 재는 법</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="치수 재는 법">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-900/50"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white pb-8 shadow-2xl animate-fade-up sm:inset-0 sm:m-auto sm:h-fit sm:max-w-lg sm:rounded-2xl sm:pb-6">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900">
                줄자 하나로 실패 없이 재는 법
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ol className="space-y-4 px-5 pt-4">
              {TIPS.map((tip, i) => (
                <li key={tip.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">{tip.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      {tip.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
