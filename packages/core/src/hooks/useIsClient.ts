'use client';

import { useSyncExternalStore } from 'react';

/**
 * 지금 브라우저에서 그리는 중인지.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 추천 엔진의 실행 결과에는 **측정한 응답시간**과 **새로 만든 일정 식별자**가 들어 있다.
 * 둘 다 실행할 때마다 달라지는 값이다. 클라이언트 컴포넌트라도 Next 는 서버에서 한 번 렌더하므로,
 * 렌더 도중 엔진을 돌리면 서버가 잰 시간(예: 14ms)이 HTML 에 박히고
 * 브라우저가 잰 시간(예: 4ms)과 어긋나 하이드레이션이 실패한다.
 * React 는 그 자리의 서버 HTML 을 통째로 버리고 다시 그린다 — 화면은 멀쩡해 보이지만
 * 콘솔에만 오류가 남아서 눈으로는 알아채기 어렵다.
 *
 * 그래서 "값이 실행마다 달라지는 계산"은 브라우저에서만 하도록 이 훅으로 막는다.
 * effect + setState 로 흉내 내지 않는 이유는 `useFullscreen` 과 같다 —
 * 서버 스냅숏을 따로 두면 하이드레이션 자체가 어긋날 일이 없다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 구독할 외부 상태가 없다. 값이 바뀌지 않으므로 해지 함수만 돌려준다. */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
