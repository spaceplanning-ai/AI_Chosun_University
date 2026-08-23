'use client';

import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * 선택형 옵션 칩.
 *
 * 여행조건 5단계 화면의 유일한 입력 수단이다. 키오스크는 마우스 호버가 없으므로
 * 선택 상태는 색·테두리·체크 표시 세 가지로 동시에 표현한다.
 * 큰 글씨 모드에서는 보조 설명을 숨겨 글자 수를 줄인다.
 *
 * 선택 방식을 prop 으로 받는 이유는 접근성 때문이다.
 * "하나만 고르는 질문"에 checkbox 시맨틱을 쓰면 스크린리더가 복수 선택이 가능하다고
 * 잘못 안내한다. 시각적 형태는 같아도 역할은 달라야 한다.
 */

export type ChipSelectionMode = 'single' | 'multiple';

export interface ChipProps {
  label: string;
  hint?: string;
  icon?: LucideIcon;
  selected: boolean;
  /** 'single' → radio, 'multiple' → checkbox 시맨틱. */
  selectionMode?: ChipSelectionMode;
  disabled?: boolean;
  onToggle: () => void;
  className?: string;
}

export function Chip({
  label,
  hint,
  icon: Icon,
  selected,
  selectionMode = 'multiple',
  disabled = false,
  onToggle,
  className,
}: ChipProps) {
  return (
    <button
      type="button"
      role={selectionMode === 'single' ? 'radio' : 'checkbox'}
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        // 키오스크는 서서 손가락으로 누른다. 일반 버튼보다 큰 전용 최소 높이를 쓴다.
        'group relative flex size-full min-h-option-min flex-col items-start justify-center gap-2xs',
        'rounded-card px-md py-sm text-left',
        'border-(length:--outline-width) transition-all duration-(--motion-fast) ease-out-kiosk',
        'active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40',
        selected
          ? 'border-accent bg-accent-soft text-content shadow-glow'
          : 'border-line-subtle bg-surface-card text-content-secondary hover:border-line-strong',
        className,
      )}
    >
      <span className="flex w-full items-center gap-sm">
        {Icon ? (
          <Icon
            className={cn(
              'size-[1.5em] shrink-0 transition-colors duration-(--motion-fast)',
              selected ? 'text-accent' : 'text-content-subtle',
            )}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 flex-1 text-subhead font-semibold text-balance-safe">{label}</span>
        <span
          className={cn(
            'grid size-[1.6em] shrink-0 place-items-center rounded-pill transition-all duration-(--motion-fast)',
            selected ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-transparent',
          )}
          aria-hidden
        >
          <Check className="size-[1em]" strokeWidth={3} />
        </span>
      </span>

      {hint ? (
        <span className="hide-in-large-mode pl-[2.5em] text-caption text-content-muted">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
