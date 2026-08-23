import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { TONE_SOFT, TONE_SOLID, type Tone } from './tone';

export type BadgeVariant = 'soft' | 'solid';
export type BadgeSize = 'sm' | 'md';

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: 'px-xs py-2xs text-micro gap-2xs',
  md: 'px-sm py-2xs text-caption gap-xs',
};

export interface BadgeProps {
  tone?: Tone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon: Icon,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill font-semibold whitespace-nowrap',
        variant === 'solid' ? TONE_SOLID[tone] : TONE_SOFT[tone],
        SIZE_CLASS[size],
        className,
      )}
    >
      {Icon ? <Icon className="size-[1.15em]" aria-hidden /> : null}
      {children}
    </span>
  );
}
