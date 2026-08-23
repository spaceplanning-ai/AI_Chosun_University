'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * AI 분석화면의 단계 진행 (제안서 6.3).
 *
 * 실제 계산은 수 밀리초 만에 끝난다. 그럼에도 3∼7초를 노출하는 것은 지연을 꾸미기 위함이 아니라,
 * 처리 단계를 관람객이 읽을 수 있게 만들기 위한 전시 연출이다.
 * 그래서 이 훅은 "가짜 진행률"이 아니라 실제 처리단계 이름 배열을 순서대로 밝힌다.
 *
 * 활성/비활성 스위치를 두지 않는다. 분석화면이 화면에 있을 때만 마운트되므로
 * 컴포넌트의 생명주기가 곧 이 연출의 생명주기다.
 */

export interface UseAnalysisSequenceOptions {
  /** 표시할 단계 문구. 실제 파이프라인 단계와 1:1로 대응해야 한다. */
  steps: readonly string[];
  totalDurationMs: number;
  /** 단계 사이 최소 간격(ms). 너무 빨리 넘어가면 글자가 읽히지 않는다. */
  minimumStepIntervalMs: number;
  onComplete: () => void;
}

export interface AnalysisSequenceState {
  /** 지금까지 밝혀진 단계 수 (0..steps.length). */
  revealedCount: number;
  /** 0–1 진행률. */
  progress: number;
}

export function useAnalysisSequence({
  steps,
  totalDurationMs,
  minimumStepIntervalMs,
  onComplete,
}: UseAnalysisSequenceOptions): AnalysisSequenceState {
  const [revealedCount, setRevealedCount] = useState(0);
  const stepCount = steps.length;

  // 문구 배열은 매 렌더 새로 만들어지므로 개수만 의존성으로 쓰고,
  // 완료 콜백은 ref 로 최신값을 유지해 타이머가 다시 깔리지 않게 한다.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const interval = Math.max(minimumStepIntervalMs, totalDurationMs / (stepCount + 1));
    const timers = Array.from({ length: stepCount }, (_, index) =>
      window.setTimeout(() => setRevealedCount(index + 1), interval * (index + 1)),
    );
    timers.push(window.setTimeout(() => onCompleteRef.current(), totalDurationMs));

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [stepCount, totalDurationMs, minimumStepIntervalMs]);

  return {
    revealedCount,
    progress: stepCount === 0 ? 1 : revealedCount / stepCount,
  };
}
