import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { TONE_SOFT, type Tone } from './tone';

/**
 * 안내문 블록.
 *
 * "옅은 톤 배경 + 같은 계열 글자 + 앞머리 아이콘"은 세 앱 모든 화면에 반복되는 형태다.
 * 각 화면이 클래스를 직접 나열하면 톤 하나를 바꿀 때 흩어진 문자열을 모두 찾아야 하므로,
 * 톤 어휘(`Tone`)만 받아 여기서 한 번에 해석한다.
 *
 * 아이콘은 장식이므로 `aria-hidden` 이다. 아이콘이 뜻을 나르지 않도록
 * 본문에 같은 내용이 글로 적혀 있어야 한다 — 색·기호만으로 의미를 전하지 않는다는 원칙.
 */

export type CalloutSize = 'sm' | 'md';

const SIZE_CLASS: Record<CalloutSize, string> = {
  sm: 'p-sm text-caption',
  md: 'p-md text-caption',
};

/** `aria-live` 처럼 상황에 따라 붙는 속성을 그대로 넘길 수 있도록 나머지 속성을 받는다. */
export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  tone?: Tone;
  size?: CalloutSize;
  icon?: LucideIcon;
  children: ReactNode;
}

export function Callout({
  tone = 'neutral',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...rest
}: CalloutProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-xs rounded-card',
        TONE_SOFT[tone],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon className="mt-[0.15em] size-[1.15em] shrink-0" aria-hidden /> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
