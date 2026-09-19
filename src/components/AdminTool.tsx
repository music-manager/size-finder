'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardPaste,
  Copy,
  Check,
  Download,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/categories';
import { products as seedProducts } from '@/lib/products';
import {
  hasDeepLink,
  nextId,
  parseCoupangBlob,
  toCm,
  toProductJson,
  toWon,
  type AdminRecord,
} from '@/lib/adminParse';
import type { CategoryId } from '@/lib/types';

const STORAGE_KEY = 'cmpick-admin-v1';

interface Draft {
  id: string;
  name: string;
  brand: string;
  category: CategoryId;
  width: string;
  depth: string;
  height: string;
  capacity_or_spec: string;
  tags: string;
  coupangUrl: string;
  imageUrl: string;
  htmlTag: string;
  verified: boolean;
  price: string;
}

const EMPTY: Draft = {
  id: '',
  name: '',
  brand: '',
  category: 'dryer',
  width: '',
  depth: '',
  height: '',
  capacity_or_spec: '',
  tags: '',
  coupangUrl: '',
  imageUrl: '',
  htmlTag: '',
  verified: false,
  price: '',
};

const CATEGORY_OPTIONS = CATEGORIES.filter((c) => c.id !== 'all') as {
  id: CategoryId;
  label: string;
}[];

function toDraft(p: AdminRecord): Draft {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    width: String(p.dimensions.width),
    depth: String(p.dimensions.depth),
    height: String(p.dimensions.height),
    capacity_or_spec: p.capacity_or_spec,
    tags: p.tags.join(', '),
    coupangUrl: p.coupangUrl,
    imageUrl: p.imageUrl,
    htmlTag: p.htmlTag ?? '',
    verified: p.verified,
    price: p.price ? String(p.price) : '',
  };
}

export default function AdminTool() {
  const [list, setList] = useState<AdminRecord[]>(seedProducts);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [blob, setBlob] = useState('');
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo');
  const [keyword, setKeyword] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 최초 1회 로컬 저장본 복원 (없으면 사이트 데이터로 시작)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setList(JSON.parse(raw) as AdminRecord[]);
    } catch {
      /* 저장소 접근 불가 시 사이트 데이터 그대로 사용 */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* 시크릿 모드 등에서는 저장을 건너뛴다 */
    }
  }, [list, loaded]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  /** 쿠팡에서 복사한 덩어리를 붙여넣으면 링크·이미지·HTML 을 자동으로 채운다 */
  const applyBlob = useCallback(() => {
    const parsed = parseCoupangBlob(blob);
    setDraft((prev) => ({
      ...prev,
      coupangUrl: parsed.coupangUrl || prev.coupangUrl,
      imageUrl: parsed.imageUrl || prev.imageUrl,
      htmlTag: parsed.htmlTag || prev.htmlTag,
    }));
  }, [blob]);

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      window.prompt('복사하세요', text);
    }
  }, []);

  const save = useCallback(() => {
    const w = toCm(draft.width);
    const d = toCm(draft.depth);
    const h = toCm(draft.height);
    if (!draft.name.trim()) return window.alert('제품명을 입력하세요.');
    if (w === null || d === null || h === null)
      return window.alert('가로·깊이·높이를 모두 입력하세요. (mm 로 넣으면 cm 로 자동 환산)');

    const won = toWon(draft.price);
    const id = draft.id.trim() || nextId(list, draft.category);
    const item: AdminRecord = {
      id,
      name: draft.name.trim(),
      category: draft.category,
      brand: draft.brand.trim(),
      dimensions: { width: w, depth: d, height: h },
      capacity_or_spec: draft.capacity_or_spec.trim(),
      imageUrl: draft.imageUrl.trim(),
      coupangUrl:
        draft.coupangUrl.trim() ||
        `https://www.coupang.com/np/search?q=${encodeURIComponent(draft.name.trim())}`,
      tags: draft.tags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean),
      verified: draft.verified,
      ...(draft.htmlTag.trim() ? { htmlTag: draft.htmlTag.trim() } : {}),
      ...(won
        ? { price: won, priceCheckedAt: new Date().toISOString().slice(0, 10) }
        : {}),
    };

    setList((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = item;
        return next;
      }
      return [...prev, item];
    });
    setDraft(EMPTY);
    setBlob('');
  }, [draft, list]);

  const remove = useCallback((id: string) => {
    if (!window.confirm(`${id} 를 목록에서 지울까요?`)) return;
    setList((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const stats = useMemo(() => {
    const linked = list.filter(hasDeepLink).length;
    return { total: list.length, linked, verified: list.filter((p) => p.verified).length };
  }, [list]);

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return list.filter((p) => {
      if (filter === 'todo' && hasDeepLink(p)) return false;
      if (filter === 'done' && !hasDeepLink(p)) return false;
      if (k && !`${p.id} ${p.name} ${p.brand}`.toLowerCase().includes(k)) return false;
      return true;
    });
  }, [list, filter, keyword]);

  const json = useMemo(() => toProductJson(list), [list]);

  const download = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([json + '\n'], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [json]);

  const field =
    'w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-lg font-extrabold text-slate-900">
          센치픽 상품 관리 <span className="text-brand-600">Admin</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          쿠팡에서 복사한 내용을 붙여넣으면 링크·이미지·HTML 이 자동으로 채워집니다.
          입력값은 이 브라우저에만 저장됩니다.
        </p>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {[
          { label: '전체 제품', value: stats.total, tone: 'text-slate-900' },
          { label: '딥링크 완료', value: `${stats.linked} / ${stats.total}`, tone: 'text-brand-600' },
          { label: '스펙 확인', value: `${stats.verified} / ${stats.total}`, tone: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-[11px] font-semibold text-slate-400">{s.label}</p>
            <p className={`text-lg font-extrabold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 1단계: 붙여넣기 */}
      <section className="mb-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-800">
          <ClipboardPaste className="h-4 w-4" aria-hidden="true" />1. 쿠팡에서 복사한 내용 붙여넣기
        </h2>
        <textarea
          value={blob}
          onChange={(e) => setBlob(e.target.value)}
          rows={4}
          placeholder={'링크·이미지주소·iframe 을 순서 상관없이 통째로 붙여넣으세요.\nhttps://link.coupang.com/a/...\nhttps://thumbnail10.coupangcdn.com/...\n<iframe src="https://coupa.ng/..."></iframe>'}
          className="mt-2 w-full rounded-lg border border-slate-200 p-2.5 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={applyBlob}
          className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          자동 추출해서 아래 채우기
        </button>
      </section>

      {/* 2단계: 제품 정보 */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-900">2. 제품 정보</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            제품명 *
            <input
              className={field}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="위닉스 인버터 컴팩트 건조기 4kg"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            브랜드
            <input
              className={field}
              value={draft.brand}
              onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
              placeholder="위닉스"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            카테고리
            <select
              className={field}
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as CategoryId })
              }
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {CATEGORY_LABEL[c.id]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            ID (비우면 자동 생성)
            <input
              className={field}
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              placeholder={nextId(list, draft.category)}
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {(['width', 'depth', 'height'] as const).map((k) => (
            <label key={k} className="text-xs font-semibold text-slate-600">
              {k === 'width' ? '가로 W' : k === 'depth' ? '깊이 D' : '높이 H'}
              <input
                className={field}
                inputMode="decimal"
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                placeholder="506 또는 50.6"
              />
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          200 이상 숫자는 mm 로 보고 cm 로 자동 환산합니다. (506 → 50.6)
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            용량·스펙
            <input
              className={field}
              value={draft.capacity_or_spec}
              onChange={(e) => setDraft({ ...draft, capacity_or_spec: e.target.value })}
              placeholder="4kg · 인버터 / 고객직접설치"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            가격 (원) — 비우면 미표시
            <input
              className={field}
              inputMode="numeric"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="139000"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            태그 (쉼표로 구분)
            <input
              className={field}
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              placeholder="인버터, 저소음, 로켓배송"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
            쿠팡 링크
            <input
              className={field}
              value={draft.coupangUrl}
              onChange={(e) => setDraft({ ...draft, coupangUrl: e.target.value })}
              placeholder="https://link.coupang.com/a/..."
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
            이미지 주소
            <input
              className={field}
              value={draft.imageUrl}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              placeholder="https://thumbnail10.coupangcdn.com/..."
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
            HTML 태그 (보관용 · 사이트에는 안 쓰임)
            <input
              className={field}
              value={draft.htmlTag}
              onChange={(e) => setDraft({ ...draft, htmlTag: e.target.value })}
              placeholder="<iframe ...></iframe>"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={draft.verified}
              onChange={(e) => setDraft({ ...draft, verified: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            제조사 스펙으로 치수 확인함 (✓ 스펙 확인 뱃지)
          </label>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY);
                setBlob('');
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              비우기
            </button>
            <button
              type="button"
              onClick={save}
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              목록에 저장
            </button>
          </div>
        </div>
      </section>

      {/* 3단계: 목록 */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">3. 목록</h2>
          <div className="flex gap-1">
            {(
              [
                ['todo', '링크 필요'],
                ['done', '링크 완료'],
                ['all', '전체'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  filter === k
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ID·제품명 검색"
              className="rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-xs focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-slate-200 text-[11px] text-slate-400">
              <tr>
                <th className="py-2 pr-2">ID</th>
                <th className="py-2 pr-2">제품명</th>
                <th className="py-2 pr-2">W×D×H</th>
                <th className="py-2 pr-2">가격</th>
                <th className="py-2 pr-2">링크</th>
                <th className="py-2 pr-2">스펙</th>
                <th className="py-2 pr-2">HTML</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-2 font-mono text-[11px] text-slate-400">{p.id}</td>
                  <td className="py-2 pr-2">
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="ml-1 text-[10px] text-slate-400">
                      {CATEGORY_LABEL[p.category]}
                    </span>
                  </td>
                  <td className="py-2 pr-2 tabular-nums text-slate-600">
                    {p.dimensions.width}×{p.dimensions.depth}×{p.dimensions.height}
                  </td>
                  <td className="py-2 pr-2 tabular-nums text-slate-600">
                    {p.price ? p.price.toLocaleString('ko-KR') : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-2 pr-2">
                    {hasDeepLink(p) ? (
                      <span className="font-bold text-brand-600">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {p.verified ? (
                      <span className="font-bold text-emerald-600">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {p.htmlTag ? (
                      <button
                        type="button"
                        onClick={() => copy(p.htmlTag as string, `html-${p.id}`)}
                        className="rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
                        title="HTML 태그 복사"
                      >
                        {copied === `html-${p.id}` ? '복사됨' : '복사'}
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setDraft(toDraft(p))}
                      className="rounded px-2 py-1 text-[11px] font-bold text-brand-600 hover:bg-brand-50"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      className="rounded px-1.5 py-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      aria-label={`${p.id} 삭제`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    해당하는 제품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4단계: 내보내기 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-bold text-slate-900">4. 내보내기</h2>
        <p className="mb-3 text-xs text-slate-500">
          아래 JSON 을 그대로 전달하면 <code className="text-brand-600">products.json</code> 에 바로 반영됩니다.
          HTML 태그는 사이트에서 쓰지 않으므로 JSON 에는 포함되지 않고, 이 브라우저에만 보관됩니다.
          가격을 입력하면 저장한 날짜가 기준일로 함께 기록되어 카드에 “YYYY.MM 기준” 으로 표시됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy(json, 'json')}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
          >
            {copied === 'json' ? (
              <><Check className="h-4 w-4" aria-hidden="true" />복사됨</>
            ) : (
              <><Copy className="h-4 w-4" aria-hidden="true" />전체 JSON 복사</>
            )}
          </button>
          <button
            type="button"
            onClick={download}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            파일로 저장
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('사이트에 배포된 데이터로 되돌립니다. 저장한 내용이 사라집니다.'))
                setList(seedProducts);
            }}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            사이트 데이터로 초기화
          </button>
        </div>
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[10px] leading-relaxed text-slate-200">
          {json}
        </pre>
      </section>

      <p className="mt-6 flex items-center gap-1 text-[11px] text-slate-400">
        <Plus className="h-3 w-3" aria-hidden="true" />
        데이터는 이 브라우저(localStorage)에만 저장됩니다. 다른 기기에서는 보이지 않으니,
        작업 후 JSON 을 복사해 전달하세요.
      </p>
    </div>
  );
}
