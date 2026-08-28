import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { clamp, roundTo } from '../../lib/number';
import { TONE_FILL, TONE_TEXT, type Tone } from './tone';

/**
 * 0–100 점수 막대.
 *
 * 추천점수·신뢰도·연계지수가 모두 이 컴포넌트를 쓴다.
 * 화면마다 막대를 새로 그리면 같은 70점이 어떤 곳에서는 길고 어떤 곳에서는 짧게 보인다.
 */

export interface MeterProps {
  label: ReactNode;
  value: number;
  max?: number;
  tone?: Tone;
  /** 값 오른쪽에 붙는 단위. 기본은 점수이므로 '점'. */
  unit?: string;
  /** 막대 아래 한 줄 설명. 근거 문장을 그대로 넣는다. */
  description?: ReactNode;
  /** 비교 대상 값. 있으면 막대 위에 기준선을 그린다. */
  reference?: number;
  /**
   * 라벨과 값을 눈에서 감춘다. 바로 위에 같은 제목이 이미 있는 자리에 쓴다.
   * 화면에서만 감출 뿐 접근성 트리에는 남으므로, 스크린리더는 여전히 무엇의 막대인지 안다.
   */
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function Meter({
  label,
  value,
  max = 100,
  tone = 'brand',
  unit = '점',
  description,
  reference,
  hideLabel = false,
  size = 'md',
  className,
}: MeterProps) {
  const ratio = max === 0 ? 0 : clamp(value / max, 0, 1);
  const referenceRatio =
    reference === undefined || max === 0 ? undefined : clamp(reference / max, 0, 1);

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('flex items-baseline justify-between gap-sm', hideLabel && 'sr-only-text')}>
        <span className={cn('text-content-secondary', size === 'sm' ? 'text-micro' : 'text-caption')}>
          {label}
        </span>
        <span
          className={cn('font-bold', TONE_TEXT[tone], size === 'sm' ? 'text-caption' : 'text-label')}
          data-numeric=""
        >
          {roundTo(value, 1)}
          <span className="ml-[0.15em] text-content-muted font-medium">{unit}</span>
        </span>
      </div>

      <div
        className={cn(
          'relative mt-2xs w-full overflow-hidden rounded-pill bg-track',
          size === 'sm' ? 'h-[0.4rem]' : 'h-[0.6rem]',
        )}
        role="meter"
        aria-valuenow={roundTo(value, 1)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            'h-full rounded-pill transition-[width] duration-(--motion-slow) ease-out-kiosk',
            TONE_FILL[tone],
          )}
          style={{ width: `${ratio * 100}%` }}
        />
        {referenceRatio === undefined ? null : (
          <div
            className="absolute inset-y-0 w-[2px] bg-content-subtle"
            style={{ left: `${referenceRatio * 100}%` }}
            aria-hidden
          />
        )}
      </div>

      {description ? (
        <p className="mt-2xs text-micro leading-relaxed text-content-muted">{description}</p>
      ) : null}
    </div>
  );
}
