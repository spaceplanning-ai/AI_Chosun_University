import { cn } from '../../lib/cn';

/**
 * 단계 진행 표시.
 *
 * 관람객이 "몇 걸음 남았는지" 즉시 알 수 있어야 이탈이 줄어든다(전시 체험 1∼2분 전제).
 * 숫자와 막대를 함께 쓰는 이유는 색·형태만으로는 남은 분량이 읽히지 않기 때문이다.
 */

export interface StepProgressProps {
  /** 0부터 시작하는 현재 단계. */
  currentStep: number;
  totalSteps: number;
  /** 지금 단계의 짧은 이름. 숫자 옆에 함께 적어 «무엇을 묻는 단계인지»를 남긴다. */
  stepLabel?: string;
  className?: string;
}

export function StepProgress({ currentStep, totalSteps, stepLabel, className }: StepProgressProps) {
  const safeTotal = Math.max(1, totalSteps);
  const stepNumber = Math.min(currentStep + 1, safeTotal);

  return (
    <div className={cn('flex items-center gap-md', className)}>
      <p className="text-caption font-semibold text-content-muted whitespace-nowrap" data-numeric="">
        <span className="text-accent">{stepNumber}</span>
        <span className="mx-[0.2em]">/</span>
        {safeTotal}
        {stepLabel === undefined ? null : (
          <span className="ms-xs font-semibold text-content" data-numeric={undefined}>
            {stepLabel}
          </span>
        )}
      </p>
      <ol
        className="flex flex-1 items-center gap-2xs"
        aria-label={`전체 ${safeTotal}단계 중 ${stepNumber}단계${stepLabel === undefined ? '' : ` — ${stepLabel}`}`}
      >
        {Array.from({ length: safeTotal }, (_, index) => (
          <li
            key={index}
            aria-current={index === currentStep ? 'step' : undefined}
            className={cn(
              'h-[0.375rem] flex-1 rounded-pill transition-colors duration-(--motion-normal) ease-out-kiosk',
              index < currentStep && 'bg-accent',
              index === currentStep && 'bg-accent',
              index > currentStep && 'bg-track',
            )}
          />
        ))}
      </ol>
    </div>
  );
}
