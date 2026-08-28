'use client';

import { useCallback, useMemo } from 'react';
import { ArrowRight, Check, Loader } from 'lucide-react';
import { ANALYSIS_TIMING_MS } from '@namdo-prism/core/config';
import { getAttraction } from '@namdo-prism/core/data';
import { useAnalysisSequence } from '@namdo-prism/core/hooks';
import { REGION_LABELS } from '@namdo-prism/core/domain';
import { cn } from '@namdo-prism/core/lib';
import { Button } from '@namdo-prism/core/ui';
import { useKiosk } from '@/state/kioskStore';

/**
 * AI 분석화면 (제안서 6.3).
 *
 * 단계 문구는 장식이 아니라 실제 처리 파이프라인의 이름이며,
 * 후보 개수 같은 수치는 이미 끝난 계산의 실제 결과에서 가져온다.
 * 관람객에게 보여 주는 과정과 내부에서 일어난 일이 어긋나면 설명가능성이 무너진다.
 */

export interface AnalysisScreenProps {
  onComplete: () => void;
}

export function AnalysisScreen({ onComplete }: AnalysisScreenProps) {
  const generation = useKiosk((state) => state.generation);

  const steps = useMemo(() => {
    const trace = generation?.trace;
    const candidateRegions = (trace?.candidates ?? []).map(
      (candidate) => getAttraction(candidate.attractionId)?.region,
    );
    const gwangjuCount = candidateRegions.filter((region) => region === 'gwangju').length;
    const jeonnamCount = candidateRegions.filter((region) => region === 'jeonnam').length;

    return [
      '사용자 취향 분석 중',
      `공식 관광정보 검색 중 · ${trace?.retrieval.documents.length ?? 0}건 확인`,
      `${REGION_LABELS.gwangju} 관광지 후보 ${gwangjuCount}곳 확인`,
      `${REGION_LABELS.jeonnam} 관광지 후보 ${jeonnamCount}곳 확인`,
      `정보 신뢰도·조건 미달 ${trace?.exclusions.length ?? 0}곳 제외`,
      '이동시간 및 운영조건 검토',
      `초광역 연계지수 산출 · ${trace?.linkage.score ?? 0}점`,
      '추천 근거 정리 중',
    ];
  }, [generation]);

  const handleComplete = useCallback(() => onComplete(), [onComplete]);

  const { revealedCount, progress } = useAnalysisSequence({
    steps,
    totalDurationMs: ANALYSIS_TIMING_MS.totalDuration,
    minimumStepIntervalMs: ANALYSIS_TIMING_MS.minimumStepInterval,
    onComplete: handleComplete,
  });

  return (
    <div className="flex flex-1 flex-col justify-center gap-xl py-xl" aria-live="polite">
      <header>
        <p className="text-caption font-semibold tracking-wide text-accent uppercase">
          AI 처리 과정
        </p>
        <h2 className="mt-xs text-title font-bold text-content text-balance-safe">
          여행조건을 분석해 남도 일정을 구성하고 있습니다
        </h2>
      </header>

      <div className="h-[0.5rem] w-full overflow-hidden rounded-pill bg-track">
        <div
          className="h-full rounded-pill bg-prism transition-[width] duration-(--motion-normal) ease-out-kiosk"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <ol className="flex flex-col gap-md">
        {steps.map((step, index) => {
          const done = index < revealedCount;
          const active = index === revealedCount;
          return (
            <li
              key={step}
              className={cn(
                'flex items-center gap-md text-subhead transition-opacity duration-(--motion-normal)',
                done ? 'text-content opacity-100' : active ? 'text-content opacity-100' : 'opacity-35',
              )}
            >
              <span
                className={cn(
                  'grid size-[2rem] shrink-0 place-items-center rounded-pill',
                  done ? 'bg-positive text-surface-page' : 'bg-surface-sunken text-content-subtle',
                )}
                aria-hidden
              >
                {done ? (
                  <Check className="size-[1.1rem]" strokeWidth={3} />
                ) : (
                  <Loader className={cn('size-[1.1rem]', active && 'animate-spin')} />
                )}
              </span>
              <span className="text-balance-safe">{step}</span>
            </li>
          );
        })}
      </ol>

      {/*
        건너뛰기.

        이 화면은 4.6초 뒤 스스로 결과로 넘어간다. 지침은 조작 없이 자동으로 바뀌는
        화면에는 그것을 제어할 수단을 두라고 정한다 — 과정이 궁금하지 않은 사람에게
        기다리라고 할 이유가 없다. 계산은 이미 끝나 있으므로 눌러도 결과는 같다.
      */}
      <div className="flex justify-center">
        <Button variant="quiet" size="sm" iconRight={ArrowRight} onClick={handleComplete}>
          결과 바로 보기
        </Button>
      </div>
    </div>
  );
}
