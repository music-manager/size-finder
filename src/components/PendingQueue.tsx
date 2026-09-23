'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, Inbox, Loader2, Trash2 } from 'lucide-react';
import { CATEGORY_LABEL } from '@/lib/categories';
import { pendingProducts } from '@/lib/products';
import { formatWon, toCm } from '@/lib/adminParse';
import type { PendingProduct, Product } from '@/lib/types';

interface Props {
  /** 현재 브라우저에서 이미 처리한 상품 id */
  doneIds: Set<string>;
  onRegister: (product: Product) => void;
  onSkip: (id: string) => void;
}

interface PendingStateRow {
  id: string;
  status: 'registered' | 'skipped';
}

/**
 * 쿠팡 API 는 치수를 주지 않는다. 수집 상품은 여기서 관리자 검증을 거친다.
 * 등록/제외는 서버 API에 영구 저장되고 성공한 뒤에만 화면에서 제거된다.
 */
export default function PendingQueue({ doneIds, onRegister, onSkip }: Props) {
  const [dims, setDims] = useState<Record<string, [string, string, string]>>({});
  const [serverDoneIds, setServerDoneIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/admin/api/catalog', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('대기열 처리 상태를 불러오지 못했습니다.');
        return (await response.json()) as { rows?: PendingStateRow[] };
      })
      .then((data) => {
        if (cancelled) return;
        setServerDoneIds(new Set((data.rows ?? []).map((row) => row.id)));
      })
      .catch(() => {
        // 서버 상태를 못 읽어도 기존 정적 대기열은 보여준다. 쓰기 작업은 별도로 fail-closed 된다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const queue = useMemo(
    () => pendingProducts.filter((p) => !doneIds.has(p.id) && !serverDoneIds.has(p.id)),
    [doneIds, serverDoneIds],
  );

  const setDim = (id: string, index: 0 | 1 | 2, value: string) =>
    setDims((prev) => {
      const next: [string, string, string] = [...(prev[id] ?? ['', '', ''])] as [
        string,
        string,
        string,
      ];
      next[index] = value;
      return { ...prev, [id]: next };
    });

  const register = async (item: PendingProduct) => {
    const [w, d, h] = dims[item.id] ?? ['', '', ''];
    const width = toCm(w);
    const depth = toCm(d);
    const height = toCm(h);
    if (width === null || depth === null || height === null) {
      window.alert('가로·깊이·높이를 모두 입력하세요. (mm 로 넣으면 cm 로 자동 환산)');
      return;
    }

    const { keyword, rank, collectedAt, ...rest } = item;
    void keyword;
    void rank;
    void collectedAt;
    const product: Product = {
      ...rest,
      dimensions: { width, depth, height },
      verified: true,
    };

    setBusyId(item.id);
    try {
      const response = await fetch('/admin/api/catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save_product',
          pendingId: item.id,
          product,
        }),
      });
      if (!response.ok) throw new Error('DB 저장에 실패했습니다.');

      setServerDoneIds((prev) => new Set(prev).add(item.id));
      onRegister(product);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'DB 저장에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const skip = async (item: PendingProduct) => {
    if (!window.confirm('이 상품을 수집 대기열에서 제외할까요?')) return;
    setBusyId(item.id);
    try {
      const response = await fetch('/admin/api/catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'skip_pending',
          pendingId: item.id,
          productId: item.productId ?? null,
        }),
      });
      if (!response.ok) throw new Error('제외 상태 저장에 실패했습니다.');

      setServerDoneIds((prev) => new Set(prev).add(item.id));
      onSkip(item.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '제외 상태 저장에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <Inbox className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
        <p className="mt-2 text-sm font-bold text-slate-700">대기열이 비어 있습니다</p>
        <p className="mt-1 text-xs text-slate-400">
          쿠팡 수집이 돌면 치수가 없는 상품이 여기에 쌓입니다.
        </p>
      </div>
    );
  }

  const cell =
    'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-bold text-brand-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        상세페이지에서 치수를 확인해 3칸만 채우면 DB와 운영 상품 목록에 바로 등록됩니다. mm 로 넣어도 cm 로
        자동 환산되고, 등록 시 <b>✓ 스펙 확인</b> 이 붙습니다.
      </p>

      {queue.map((item) => {
        const [w, d, h] = dims[item.id] ?? ['', '', ''];
        const busy = busyId === item.id;
        return (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start gap-3">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded border border-slate-100 object-contain"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="font-mono">{item.id}</span>
                  <span>·</span>
                  <span>{CATEGORY_LABEL[item.category]}</span>
                  <span>·</span>
                  <span>
                    {item.keyword}
                    {item.rank !== null && ` ${item.rank}위`}
                  </span>
                </p>
                <p className="line-clamp-2 text-[13px] font-semibold text-slate-800">
                  {item.name}
                </p>
                <p className="mt-0.5 text-xs font-bold text-rose-600">
                  {item.price ? `${formatWon(item.price)}원` : '가격 미확인'}
                </p>
              </div>
              <a
                href={item.coupangUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
              >
                상세 열기
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-2.5 flex items-end gap-2">
              {(
                [
                  ['가로 W', w, 0],
                  ['깊이 D', d, 1],
                  ['높이 H', h, 2],
                ] as const
              ).map(([label, value, index]) => (
                <label key={label} className="flex-1 text-[10px] font-bold text-slate-500">
                  {label}
                  <input
                    className={cell}
                    inputMode="decimal"
                    value={value}
                    placeholder="예: 47 또는 470mm"
                    disabled={busy}
                    onChange={(e) => setDim(item.id, index, e.target.value)}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() => void register(item)}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                {busy ? '저장 중' : '등록'}
                {!busy && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={() => void skip(item)}
                disabled={busy}
                title="이 상품은 쓰지 않음"
                className="rounded-lg border border-slate-200 p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:cursor-wait disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
