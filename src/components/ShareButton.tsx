'use client';

import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';

/** 현재 필터가 담긴 URL 을 복사 — 블로그/고정댓글에 그대로 붙여넣기 위한 버튼 */
export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // 클립보드 권한이 없는 브라우저(구형 iOS 사파리 등) 폴백
      window.prompt('아래 주소를 복사하세요', url);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          복사됨
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          링크 복사
        </>
      )}
    </button>
  );
}
