'use client';

import { useLayoutEffect } from 'react';
import type { Product } from '@/lib/types';

const STORAGE_KEY = 'cmpick-admin-v1';
const DONE_KEY = 'cmpick-admin-done-v1';

interface Props {
  products: Product[];
  doneIds: string[] | null;
}

/**
 * 관리자 화면의 레거시 localStorage가 최신 DB 상태를 덮어쓰지 않게
 * 서버에서 읽은 실시간 카탈로그와 처리 완료 대기열 ID를 hydration 직전에 동기화한다.
 */
export default function AdminLiveBootstrap({ products, doneIds }: Props) {
  useLayoutEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      // 서버 조회가 실제로 성공한 경우에만 처리 상태를 갱신한다.
      // null은 일시적인 서버/설정 오류이므로 기존 로컬 상태를 보존한다.
      if (doneIds !== null) {
        window.localStorage.setItem(DONE_KEY, JSON.stringify(doneIds));
      }
    } catch {
      // 저장소를 사용할 수 없어도 AdminTool은 seed fallback으로 동작한다.
    }
  }, [products, doneIds]);

  return null;
}
