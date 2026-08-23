'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * 모든 터치 대상의 기준 컴포넌트.
 *
 * 높이·글자크기·여백을 전부 토큰으로만 지정하므로, 큰 글씨 모드로 전환하면
 * 이 파일을 고치지 않아도 버튼이 통째로 커진다.
 */

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'quiet' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover shadow-card',
  accent: 'bg-accent text-on-accent hover:bg-accent-hover shadow-glow',
  outline:
    'bg-transparent text-content border-line-strong hover:bg-surface-raised border-(length:--outline-width)',
  quiet: 'bg-surface-raised text-content hover:bg-surface-sunken surface-outline',
  ghost: 'bg-transparent text-content-muted hover:bg-surface-raised hover:text-content',
};

/**
 * 작은 버튼은 채움색을 한 단계 어둡게 쓴다.
 *
 * 지정 파랑 위의 흰 글자는 3.71:1 이다. 큰 글자(24px·굵은 18.7px 이상)에는 충분하지만
 * `sm` 의 글자는 그보다 작아 4.5:1 을 넘겨야 한다. 색상(hue)은 그대로 두고 명도만 내린다.
 */
const FILLED_VARIANTS = new Set<ButtonVariant>(['primary', 'accent']);

/**
 * 비활성 표현.
 *
 * 색을 채운 버튼을 투명도만 낮추면 «연한 파란 버튼»으로 보인다.
 * 키오스크에서는 그걸 눌러 보고 반응이 없으면 고장으로 읽히므로,
 * 채운 버튼은 아예 회색 판으로 바꿔 누를 수 없음을 형태로 알린다.
 * 테두리·글자만 있는 버튼은 이미 존재감이 약해 투명도로 충분하다.
 */
const DISABLED_FILLED =
  'disabled:bg-surface-sunken disabled:text-content-disabled disabled:shadow-none';
const DISABLED_QUIET = 'disabled:opacity-45';

const SIZE_FILL_CLASS: Partial<Record<ButtonSize, Record<'primary' | 'accent', string>>> = {
  sm: {
    primary: 'bg-brand-strong hover:bg-brand-strong',
    accent: 'bg-accent-strong hover:bg-accent-strong',
  },
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-control-sm px-md text-label gap-xs rounded-control',
  md: 'min-h-control-md px-lg text-subhead gap-sm rounded-control',
  lg: 'min-h-control-lg px-xl text-heading gap-sm rounded-card',
};

/**
 * 아이콘 크기.
 *
 * `shrink-0` 이 핵심이다. flex 항목은 기본적으로 줄어들 수 있어서, 글자가 길거나
 * 줄바꿈이 막혀 있으면 **아이콘이 0px 로 찌그러져 사라진다.** 버튼은 멀쩡해 보이는데
 * 화살표만 없어지는 형태로 드러나 원인을 찾기 어렵다.
 */
const ICON_SIZE: Record<ButtonSize, string> = {
  sm: 'size-[1.25em] shrink-0',
  md: 'size-[1.15em] shrink-0',
  lg: 'size-[1.1em] shrink-0',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  /** 아이콘만 있는 버튼. 스크린리더용 이름은 `aria-label` 로 반드시 넘길 것. */
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'quiet',
  size = 'md',
  fullWidth = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  iconOnly = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-semibold',
        'transition-[background-color,color,box-shadow,transform] duration-(--motion-fast) ease-out-kiosk',
        'active:scale-[0.985] disabled:pointer-events-none',
        FILLED_VARIANTS.has(variant) ? DISABLED_FILLED : DISABLED_QUIET,
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        FILLED_VARIANTS.has(variant)
          ? SIZE_FILL_CLASS[size]?.[variant as 'primary' | 'accent']
          : undefined,
        iconOnly && 'aspect-square px-0',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {IconLeft ? <IconLeft className={ICON_SIZE[size]} aria-hidden /> : null}
      {children}
      {IconRight ? <IconRight className={ICON_SIZE[size]} aria-hidden /> : null}
    </button>
  );
}
