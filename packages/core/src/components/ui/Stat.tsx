import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { TONE_SOFT, TONE_TEXT, type Tone } from './tone';

/**
 * 수치 타일.
 *
 * 변화 방향(delta)은 색과 부호를 함께 쓴다. 색만으로 개선/악화를 표현하면
 * 색각 이상 관람객에게 정보가 전달되지 않는다.
 */

export type StatDirection = 'improved' | 'worsened' | 'neutral' | 'unchanged';

const DIRECTION_TONE: Record<StatDirection, Tone> = {
  improved: 'positive',
  worsened: 'critical',
  neutral: 'neutral',
  unchanged: 'neutral',
};

const DIRECTION_PREFIX: Record<StatDirection, string> = {
  improved: '▼',
  worsened: '▲',
  neutral: '→',
  unchanged: '–',
};

export interface StatProps {
  label: ReactNode;
  value: number | string;
  unit?: string;
  tone?: Tone;
  icon?: LucideIcon;
  /** 변화량. 지정하면 값 아래에 방향 표시와 함께 나타난다. */
  delta?: number;
  direction?: StatDirection;
  hint?: ReactNode;
  className?: string;
  /**
   * 담기는 자리.
   *
   * `panel` — 이미 테두리가 있는 판 안. 테두리를 또 그리면 선이 겹쳐 무거워지므로
   *           옅은 배경만으로 구분한다.
   * `page`  — 판 밖에 단독으로 놓일 때. 이때는 테두리가 있어야 덩어리로 읽힌다.
   */
  surface?: 'page' | 'panel';
}

export function Stat({
  label,
  value,
  unit,
  tone = 'neutral',
  icon: Icon,
  delta,
  direction = 'unchanged',
  hint,
  className,
  surface = 'panel',
}: StatProps) {
  // 개선을 뜻하는 화살표 방향은 값이 실제로 움직인 방향을 따라야 한다.
  const arrow =
    delta === undefined || delta === 0
      ? DIRECTION_PREFIX.unchanged
      : delta < 0
        ? '▼'
        : '▲';

  return (
    <div
      className={cn(
        'rounded-card p-md',
        surface === 'panel' ? 'bg-surface-sunken' : 'bg-surface-card surface-outline',
        className,
      )}
    >
      <div className="flex items-start gap-xs text-caption text-content-muted">
        {Icon ? (
          <span className={cn('shrink-0 rounded-pill p-2xs', TONE_SOFT[tone])}>
            <Icon className="size-[1.1em]" aria-hidden />
          </span>
        ) : null}
        {/*
          라벨은 자르지 않고 줄바꿈한다. 글자를 키우면 같은 폭에 덜 들어가는데,
          바로 그 「큰 글씨 모드」에서 "평균 정보 신뢰…" 처럼 말줄임으로 잘려 나갔다.
          큰 글씨가 필요한 사람에게 정보를 감추는 셈이라, 타일이 세로로 늘어나는 편이 낫다.
        */}
        <span className="min-w-0">{label}</span>
      </div>

      <p className="mt-2xs flex items-baseline gap-[0.2em]">
        <span className={cn('text-heading font-bold', TONE_TEXT[tone])} data-numeric="">
          {value}
        </span>
        {unit ? <span className="text-caption text-content-muted">{unit}</span> : null}
      </p>

      {delta === undefined ? null : (
        <p
          className={cn('mt-2xs text-caption font-semibold', TONE_TEXT[DIRECTION_TONE[direction]])}
          data-numeric=""
        >
          {arrow} {Math.abs(delta)}
          {unit ? <span className="ml-[0.15em] font-medium">{unit}</span> : null}
        </p>
      )}

      {hint ? <p className="mt-2xs text-micro text-content-subtle">{hint}</p> : null}
    </div>
  );
}
