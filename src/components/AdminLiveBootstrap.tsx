'use client';

import { useLayoutEffect } from 'react';
import type { Product } from '@/lib/types';

const STORAGE_KEY = 'cmpick-admin-v1';

/**
 * 관리자 화면의 레거시 localStorage 목록이 최신 DB/seed 카탈로그를 덮어쓰지 않게
 * 서버에서 읽은 실시간 카탈로그를 hydration 직전에 동기화한다.
 */
export default function AdminLiveBootstrap({ products }: { products: Product[] }) {
  useLayoutEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch {
      // 저장소를 사용할 수 없어도 AdminTool은 seed fallback으로 동작한다.
    }
  }, [products]);

  return null;
}
