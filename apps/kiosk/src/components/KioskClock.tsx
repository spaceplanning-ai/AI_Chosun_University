'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@namdo-prism/core/lib';

/**
 * 안내판 머리말의 날짜·시각.
 *
 * 관공서 안내 키오스크가 시각을 띄우는 이유는 장식이 아니라 **장치가 살아 있다는 신호**다.
 * 멈춘 화면과 켜져 있는 화면을 관람객이 구분할 수 있어야 진행자를 부르지 않는다.
 * 초까지 보여 주는 것도 같은 이유다 — 숫자가 움직이는 것만으로 «지금 켜져 있다»가 전달된다.
 *
 * 「지금」은 React가 아니라 브라우저가 가진 값이므로 effect + setState 로 흉내 내지 않고
 * `useSyncExternalStore` 로 구독한다. 서버 스냅숏을 따로 두었기 때문에
 * 서버가 그린 시각과 브라우저가 그린 시각이 어긋나 하이드레이션이 깨지는 일도 없다.
 */

/** 초를 표시하므로 1초마다 확인한다. */
const TICK_MS = 1000;

function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, TICK_MS);
  return () => window.clearInterval(timer);
}

/** 초가 바뀔 때만 값이 달라진다. 같은 값이면 React 가 다시 그리지 않는다. */
const getSnapshot = () => Math.floor(Date.now() / 1000);

/** 서버에는 「지금」이 없다. 0 은 «아직 시각을 모른다»는 뜻으로만 쓴다. */
const getServerSnapshot = () => 0;

const pad = (value: number) => String(value).padStart(2, '0');

export function KioskClock({ className }: { className?: string }) {
  const second = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // 시각을 모르는 동안은 자리만 잡는다. 값이 없는데 지어내면 안 된다.
  if (second === 0) {
    return <div className={cn('h-[2.6em] w-[9rem]', className)} aria-hidden />;
  }

  const now = new Date(second * 1000);
  const hours = now.getHours();
  const meridiem = hours < 12 ? 'AM' : 'PM';
  // 12시간제. 0시와 12시가 모두 12로 표시되어야 한다.
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  return (
    <div className={cn('text-right leading-tight', className)}>
      <p className="text-micro text-content-muted" data-numeric="">
        {now.getFullYear()}년 {pad(now.getMonth() + 1)}월 {pad(now.getDate())}일
      </p>
      <p className="text-label font-bold text-content" data-numeric="">
        {meridiem} {pad(displayHours)}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
      </p>
    </div>
  );
}
