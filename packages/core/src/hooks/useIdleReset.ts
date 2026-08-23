'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 무조작 자동 초기화 (제안서 12.1 "자동 초기화 및 대기화면 복귀").
 *
 * 전시장 키오스크는 관람객이 도중에 그냥 떠난다. 남은 화면을 그대로 두면
 * 다음 사람이 앞사람의 여행조건을 이어받게 되고, 로그도 뒤섞인다.
 *
 * 곧바로 초기화하지 않고 경고 단계를 두는 이유는, 화면을 읽는 중인 관람객이
 * 아무 조작 없이 결과를 들여다보고 있을 수 있기 때문이다.
 */

export interface UseIdleResetOptions {
  /** 경고를 띄우기까지의 무조작 시간(ms). */
  warnAfterMs: number;
  /** 경고 후 초기화까지의 유예(ms). */
  resetAfterMs: number;
  onReset: () => void;
  /** 대기화면에서는 감시할 필요가 없다. */
  enabled?: boolean;
}

export interface IdleResetState {
  isWarning: boolean;
  /** 초기화까지 남은 초. 경고 중이 아니면 0. */
  secondsRemaining: number;
  /** "계속 볼게요"에 연결한다. */
  keepAlive: () => void;
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export function useIdleReset({
  warnAfterMs,
  resetAfterMs,
  onReset,
  enabled = true,
}: UseIdleResetOptions): IdleResetState {
  /**
   * 조작이 있을 때마다 증가하는 세대 번호.
   * 경고 상태를 불리언으로 들고 있으면 "언제 켜고 언제 끄는가"를 이펙트 안에서
   * 동기적으로 처리해야 해서 렌더 연쇄가 생긴다. 대신 "몇 번째 세대에서 경고가 떴는가"를
   * 저장하고, 현재 세대와 같을 때만 경고로 간주한다.
   */
  const [activityGeneration, setActivityGeneration] = useState(0);
  const [warnedGeneration, setWarnedGeneration] = useState<number>();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isWarning = enabled && warnedGeneration === activityGeneration;

  // 부모가 매 렌더 새 함수를 넘겨도 타이머가 재시작되지 않도록 최신 콜백만 보관한다.
  const onResetRef = useRef(onReset);
  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  const registerActivity = useCallback(() => {
    setActivityGeneration((generation) => generation + 1);
    setElapsedSeconds(0);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, registerActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, registerActivity);
      }
    };
  }, [enabled, registerActivity]);

  // 무조작이 이어지면 현재 세대를 경고 상태로 표시한다.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(
      () => setWarnedGeneration(activityGeneration),
      warnAfterMs,
    );
    return () => window.clearTimeout(timer);
  }, [enabled, activityGeneration, warnAfterMs]);

  // 경고가 뜬 뒤 남은 시간을 세고, 유예가 끝나면 초기화한다.
  useEffect(() => {
    if (!isWarning) return;
    const interval = window.setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      1000,
    );
    const timer = window.setTimeout(() => onResetRef.current(), resetAfterMs);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [isWarning, resetAfterMs]);

  return {
    isWarning,
    secondsRemaining: isWarning
      ? Math.max(0, Math.ceil(resetAfterMs / 1000) - elapsedSeconds)
      : 0,
    keepAlive: registerActivity,
  };
}
