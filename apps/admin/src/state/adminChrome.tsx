'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AdminViewId } from '@/config/navigation';

/**
 * 화면과 바깥 틀(머리말·사이드바)을 잇는 통로.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 두 가지가 화면 안에서만 해결되지 않는다.
 *
 *   화면 전환은 바깥 틀이 쥐고 있어 화면 안에서는 부를 수 없다.
 *      검색이 이상하면 문서를 보고, 문서를 고치면 다시 검색해 본다.
 *      그런데 화면 전환은 바깥 틀이 쥐고 있어 화면 안에서는 부를 수 없다.
 *
 * 전역 상태 라이브러리를 새로 들이지 않고 문맥 하나로 둔다 —
 * 이 통로를 쓰는 곳이 머리말과 화면 둘뿐이기 때문이다.
 * ──────────────────────────────────────────────────────────────────
 */

interface AdminChrome {
  /** 다른 화면으로 이동한다. */
  navigate: (view: AdminViewId) => void;
}

const AdminChromeContext = createContext<AdminChrome | undefined>(undefined);

export interface AdminChromeProviderProps {
  navigate: (view: AdminViewId) => void;
  children: ReactNode;
}

export function AdminChromeProvider({ navigate, children }: AdminChromeProviderProps) {
  const value = useMemo(() => ({ navigate }), [navigate]);
  return <AdminChromeContext.Provider value={value}>{children}</AdminChromeContext.Provider>;
}

/** 화면에서 다른 화면으로 넘어갈 때 쓴다. */
export function useAdminNavigate(): (view: AdminViewId) => void {
  const chrome = useContext(AdminChromeContext);
  return chrome?.navigate ?? (() => {});
}

