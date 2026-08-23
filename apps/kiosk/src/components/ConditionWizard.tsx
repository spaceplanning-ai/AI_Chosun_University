'use client';

import { useEffect, useId, useRef } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { WIZARD_STEPS, type WizardStep } from '@namdo-prism/core/config';
import type { TravelConditions } from '@namdo-prism/core/domain';
import { Button, Chip, StepProgress } from '@namdo-prism/core/ui';
import { useKiosk } from '@/state/kioskStore';

/**
 * 여행조건 선택 5단계 (제안서 6.2).
 *
 * 단계 구성·문구·선택지는 전부 `WIZARD_STEPS` 데이터에서 온다.
 * 이 컴포넌트는 "단일 선택인가 복수 선택인가"만 알면 되고,
 * 어떤 질문이 몇 개 있는지는 알지 못한다. 단계를 추가해도 여기는 그대로다.
 */

/** 복수 선택 필드의 값 목록을 토글한다. 배타 선택지(예: '특별한 조건이 없어요')를 함께 처리한다. */
function toggleMultiValue(
  current: readonly string[],
  value: string,
  maxSelections: number,
  exclusiveValue?: string,
): string[] {
  if (current.includes(value)) {
    return current.filter((entry) => entry !== value);
  }
  // 배타 선택지를 고르면 나머지를 모두 해제한다.
  if (exclusiveValue !== undefined && value === exclusiveValue) {
    return [value];
  }
  const withoutExclusive =
    exclusiveValue === undefined ? [...current] : current.filter((entry) => entry !== exclusiveValue);

  // 상한을 넘으면 가장 먼저 고른 것을 밀어낸다. 눌렀는데 아무 반응이 없는 것보다 낫다.
  const next = [...withoutExclusive, value];
  return next.length > maxSelections ? next.slice(next.length - maxSelections) : next;
}

/**
 * 이 단계를 관람객이 실제로 답했는가.
 *
 * 단일선택 항목은 엔진에 넘길 완전한 조건을 만들기 위해 기본값이 채워져 있다.
 * 값이 들어 있다는 것만으로 「답했다」고 보면, 아무것도 누르지 않아도
 * 「다음」이 열리고 기본값이 관람객의 선택으로 기록된다.
 * 그래서 답했는지는 `answeredFields` 로만 판단한다.
 */
function isStepAnswered(
  step: WizardStep,
  conditions: TravelConditions,
  answeredFields: readonly (keyof TravelConditions)[],
): boolean {
  if (step.kind === 'single') return answeredFields.includes(step.field);
  return conditions[step.field].length > 0;
}

export function ConditionWizard() {
  const stepIndex = useKiosk((state) => state.stepIndex);
  const conditions = useKiosk((state) => state.conditions);
  const answeredFields = useKiosk((state) => state.answeredFields);
  const setConditions = useKiosk((state) => state.setConditions);
  const nextStep = useKiosk((state) => state.nextStep);
  const previousStep = useKiosk((state) => state.previousStep);

  const questionId = useId();
  const questionRef = useRef<HTMLHeadingElement>(null);

  /**
   * 단계가 바뀌면 새 질문으로 초점을 옮긴다.
   * 옮기지 않으면 스크린리더 이용자는 화면이 바뀐 사실을 모른 채
   * 이전 단계의 마지막 버튼에 머물게 된다.
   */
  useEffect(() => {
    questionRef.current?.focus();
  }, [stepIndex]);

  const step = WIZARD_STEPS[stepIndex];
  if (!step) return null;

  const answered = isStepAnswered(step, conditions, answeredFields);
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  return (
    <div className="flex flex-1 flex-col gap-lg py-md">
      <StepProgress currentStep={stepIndex} totalSteps={WIZARD_STEPS.length} />

      <header>
        <h2
          ref={questionRef}
          id={questionId}
          tabIndex={-1}
          className="text-title font-bold text-content outline-none text-balance-safe"
        >
          {step.question}
        </h2>
        <p className="hide-in-large-mode mt-2xs text-body text-content-muted">{step.helper}</p>
        {step.kind === 'multiple' ? (
          <p className="mt-xs text-caption text-accent" data-numeric="">
            {conditions[step.field].length} / {step.maxSelections} 선택
          </p>
        ) : null}
      </header>

      <div className="scrollable-y -mx-2xs flex min-h-0 flex-1 flex-col px-2xs">
        {/*
          선택지는 단계마다 4~8개다. 높이를 늘려 채우면 단계마다 칸 크기가 달라져
          손이 자리를 기억하지 못한다. 그래서 칸 크기는 고정하고,
          `content-center` 로 남는 높이를 위아래로 갈라 블록을 가운데에 둔다.
        */}
        <div
          role={step.kind === 'single' ? 'radiogroup' : 'group'}
          aria-labelledby={questionId}
          className="grid flex-1 grid-cols-2 content-center gap-sm py-sm"
        >
          {step.options.map((option) => {
            // 기본값은 「선택됨」으로 보이면 안 된다. 누른 적이 있어야 표시한다.
            const selected =
              step.kind === 'single'
                ? answeredFields.includes(step.field) && conditions[step.field] === option.value
                : (conditions[step.field] as readonly string[]).includes(option.value);

            return (
              <Chip
                key={option.value}
                label={option.label}
                hint={option.hint}
                icon={option.icon}
                selected={selected}
                selectionMode={step.kind}
                onToggle={() => {
                  if (step.kind === 'single') {
                    // 단일 선택은 고르는 즉시 다음 단계로 넘어간다 — 터치 횟수를 줄인다.
                    setConditions({ [step.field]: option.value } as Partial<TravelConditions>);
                    window.setTimeout(() => nextStep(WIZARD_STEPS.length), 180);
                    return;
                  }
                  setConditions({
                    [step.field]: toggleMultiValue(
                      conditions[step.field],
                      option.value,
                      step.maxSelections,
                      step.exclusiveValue,
                    ),
                  } as Partial<TravelConditions>);
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-sm">
        <Button variant="ghost" size="md" iconLeft={ChevronLeft} onClick={previousStep}>
          이전
        </Button>
        <Button
          variant="accent"
          size="md"
          className="flex-1"
          iconRight={ArrowRight}
          disabled={!answered}
          onClick={() => nextStep(WIZARD_STEPS.length)}
        >
          {isLastStep ? 'AI 여행일정 만들기' : '다음'}
        </Button>
      </div>
    </div>
  );
}
