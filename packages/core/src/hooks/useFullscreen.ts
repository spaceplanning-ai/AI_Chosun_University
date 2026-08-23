'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * 전체화면 키오스크 모드 (제안서 13.4).
 *
 * 전시 장비에서 브라우저 주소창과 탭이 보이면 관람객이 다른 페이지로 이동할 수 있고,
 * 세로형 화면의 유효 높이도 줄어든다.
 *
 * 브라우저 보안 정책상 전체화면 요청은 사용자 제스처 안에서만 허용되므로
 * 자동 진입은 불가능하다. 진행자가 버튼 한 번으로 켜는 것이 유일한 방법이며,
 * 그래서 이 훅은 진행자 패널에서만 쓰인다.
 *
 * 전체화면 여부는 React가 아니라 브라우저가 소유한 상태다. 그래서 effect 안에서
 * setState로 흉내 내지 않고 `useSyncExternalStore` 로 직접 구독한다 —
 * 서버 렌더 시점 스냅숏이 분리되어 하이드레이션 불일치도 생기지 않는다.
 */

export interface FullscreenState {
  isFullscreen: boolean;
  /** 브라우저가 전체화면 API를 지원하는지. 미지원 환경에서는 버튼을 숨긴다. */
  isSupported: boolean;
  toggle: () => Promise<void>;
}

function subscribe(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

const getFullscreenSnapshot = () => document.fullscreenElement !== null;
const getSupportSnapshot = () => document.fullscreenEnabled;
const getServerSnapshot = () => false;

export function useFullscreen(): FullscreenState {
  const isFullscreen = useSyncExternalStore(subscribe, getFullscreenSnapshot, getServerSnapshot);
  const isSupported = useSyncExternalStore(subscribe, getSupportSnapshot, getServerSnapshot);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (cause) {
      // 사용자가 거부했거나 정책상 차단된 경우까지 오류로 알릴 필요는 없다.
      console.warn('[남도프리즘] 전체화면 전환 실패', cause);
    }
  }, []);

  return { isFullscreen, isSupported, toggle };
}
