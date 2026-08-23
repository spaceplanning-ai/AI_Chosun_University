'use client';

import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { DELIVERY_PHASE, getEnabledRefinements } from '@namdo-prism/core/config';
import { REFINEMENT_TARGET_HINTS, type RefinementId } from '@namdo-prism/core/domain';
import { Button } from '@namdo-prism/core/ui';

/**
 * 일정 즉시 수정 버튼 (제안서 6.5).
 *
 * 노출되는 버튼 수는 납품 단계가 결정한다 — A단계는 2종, C단계는 6종.
 * 화면이 아니라 `DELIVERY_PHASE` 설정 한 줄이 범위를 정하므로,
 * 고도화 계약 시 코드 수정 없이 나머지 4종이 열린다.
 */

export interface RefineBarProps {
  onRefine: (refinementId: RefinementId) => void;
  onRestart: () => void;
  disabled?: boolean;
}

export function RefineBar({ onRefine, onRestart, disabled = false }: RefineBarProps) {
  const refinements = getEnabledRefinements(DELIVERY_PHASE);

  return (
    <section aria-label="일정 수정" className="flex flex-col gap-sm">
      <h3 className="flex items-center gap-xs text-subhead font-bold text-content">
        <SlidersHorizontal className="size-[1.1em] text-accent" aria-hidden />
        일정을 바꿔 볼까요?
      </h3>
      <p className="hide-in-large-mode text-caption text-content-muted">
        기존 일정을 통째로 바꾸지 않고, 유지할 장소와 변경할 장소를 구분해 다시 구성합니다.
      </p>

      <div className="grid grid-cols-2 gap-sm">
        {refinements.map((refinement) => (
          <Button
            key={refinement.id}
            variant="outline"
            size="sm"
            disabled={disabled}
            className="justify-start text-left"
            onClick={() => onRefine(refinement.id)}
            title={REFINEMENT_TARGET_HINTS[refinement.id]}
          >
            {refinement.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          iconLeft={RotateCcw}
          className="justify-start"
          onClick={onRestart}
        >
          조건 다시 고르기
        </Button>
      </div>
    </section>
  );
}
