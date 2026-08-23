'use client';

/**
 * 표현 컨텍스트 스토어 (일반/큰 글씨 · 밝은/전시 · 고대비 · 키오스크/모바일).
 *
 * 세 앱이 모두 같은 스토어를 쓴다. 상태가 바뀌면 `<html>` 의 data-* 속성만 갈아 끼우고,
 * 나머지는 CSS 토큰이 알아서 따라온다. 컴포넌트는 이 스토어를 구독할 필요조차 없다
 * — 토글 버튼만 구독하면 된다.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyPresentation,
  CONTRASTS,
  THEMES,
  toggleBinary,
  UI_MODES,
  type Contrast,
  type PresentationContext,
  type Surface,
  type Theme,
  type UiMode,
} from '../design/presentation';

interface PresentationState extends PresentationContext {
  setUiMode: (uiMode: UiMode) => void;
  setTheme: (theme: Theme) => void;
  setContrast: (contrast: Contrast) => void;
  setSurface: (surface: Surface) => void;
  toggleUiMode: () => void;
  toggleTheme: () => void;
  toggleContrast: () => void;
  reset: () => void;
}

/** 스토어를 앱별 기본값으로 만든다. 키오스크와 모바일은 출발점이 다르다. */
export function createPresentationStore(defaults: PresentationContext, storageKey: string) {
  return create<PresentationState>()(
    persist(
      (set, get) => ({
        ...defaults,
        setUiMode: (uiMode) => set({ uiMode }),
        setTheme: (theme) => set({ theme }),
        setContrast: (contrast) => set({ contrast }),
        setSurface: (surface) => set({ surface }),
        toggleUiMode: () => set({ uiMode: toggleBinary(get().uiMode, UI_MODES) }),
        toggleTheme: () => set({ theme: toggleBinary(get().theme, THEMES) }),
        toggleContrast: () => set({ contrast: toggleBinary(get().contrast, CONTRASTS) }),
        reset: () => set({ ...defaults }),
      }),
      {
        name: storageKey,
        // surface 는 앱이 결정하는 값이므로 저장하지 않는다.
        // 저장하면 모바일에서 켠 설정이 키오스크 레이아웃을 망가뜨릴 수 있다.
        partialize: ({ uiMode, theme, contrast }) => ({ uiMode, theme, contrast }),
      },
    ),
  );
}

export type PresentationStore = ReturnType<typeof createPresentationStore>;

/**
 * 스토어 값을 `<html>` 속성에 반영한다.
 *
 * 첫 렌더에서 마크업을 분기하지 않고 effect 안에서만 DOM을 만지는 이유는
 * 서버가 그린 HTML과 클라이언트 하이드레이션이 어긋나지 않게 하기 위함이다.
 * 저장된 설정은 하이드레이션 직후 한 프레임 안에 적용된다.
 */
export function usePresentationSync(useStore: PresentationStore): void {
  const uiMode = useStore((state) => state.uiMode);
  const theme = useStore((state) => state.theme);
  const contrast = useStore((state) => state.contrast);
  const surface = useStore((state) => state.surface);

  useEffect(() => {
    applyPresentation({ uiMode, theme, contrast, surface });
  }, [uiMode, theme, contrast, surface]);
}
