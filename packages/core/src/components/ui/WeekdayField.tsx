'use client';

import { useState } from 'react';
import { CalendarOff } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { FieldFrame, ReadonlyValue, type FieldFrameProps } from './Form';
import { Sheet } from './Sheet';

/**
 * 요일 칸.
 *
 * ── 왜 골라서 넣게 하는가 ──────────────────────────────────────────
 * 휴무일을 손으로 치면 「월」·「월요일」·「매주 월」이 섞이고, 쉼표를 빠뜨리면
 * 「월 화」가 요일 하나로 저장된다. 일정 계산은 요일 이름이 정확히 맞아야
 * 「그날은 닫혀 있음」을 알 수 있어서, 표기가 어긋나면 문 닫힌 곳을 추천한다.
 *
 * 고르는 값은 일곱 개뿐이라 창 안에서 한눈에 보인다 — 목록으로 굴릴 것이 없다.
 */

/** 요일 이름. 자료에 저장되는 글자 그대로다. */
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface WeekdayFieldProps extends Omit<FieldFrameProps, 'children'> {
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** 하나도 안 고른 상태의 뜻. 휴무일에서는 「연중무휴」다. */
  emptyLabel?: string;
  /** 조회 상태. 고른 요일만 보여 준다. */
  readOnly?: boolean;
}

export function WeekdayField({
  values,
  onChange,
  emptyLabel = '연중무휴',
  readOnly = false,
  ...frame
}: WeekdayFieldProps) {
  const [open, setOpen] = useState(false);
  /** 창 안에서 고르는 중인 요일. 「확인」을 눌러야 밖으로 나간다. */
  const [pending, setPending] = useState<string[]>([]);

  /** 자료에 적힌 순서와 무관하게 늘 월요일부터 보여 준다. */
  const ordered = (days: readonly string[]): string[] => [
    ...WEEKDAYS.filter((day) => days.includes(day)),
    // 자료에 요일 아닌 글자가 들어 있어도 버리지 않는다. 지우는 것은 사람이 정한다.
    ...days.filter((day) => !WEEKDAYS.includes(day as Weekday)),
  ];

  const chosen = ordered(values);

  if (readOnly) {
    return (
      <FieldFrame {...frame} as="div">
        <ReadonlyValue>
          {chosen.length === 0 ? emptyLabel : `매주 ${chosen.join(' · ')} 휴무`}
        </ReadonlyValue>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame {...frame} as="div">
      <button
        type="button"
        aria-label={frame.label}
        onClick={() => {
          setPending([...values]);
          setOpen(true);
        }}
        className={cn(
          'inline-flex min-h-control-sm w-full items-center gap-xs rounded-control bg-surface-card px-md text-caption surface-outline',
          'transition-colors duration-(--motion-fast) hover:bg-surface-sunken',
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-start',
            chosen.length === 0 ? 'text-content-subtle' : 'font-semibold text-content',
          )}
        >
          {chosen.length === 0 ? emptyLabel : `매주 ${chosen.join(' · ')} 휴무`}
        </span>
        <CalendarOff className="size-[1.1em] shrink-0 text-content-subtle" aria-hidden />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        placement="center"
        title={`${frame.label} 고르기`}
        description="쉬는 요일을 고릅니다. 하나도 안 고르면 연중무휴입니다."
        footer={
          <span className="flex items-center justify-between gap-sm">
            <strong className="text-subhead font-bold text-content">
              {pending.length === 0 ? emptyLabel : ordered(pending).join(' · ')}
            </strong>
            <span className="flex gap-sm">
              <Button variant="quiet" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  onChange(ordered(pending));
                  setOpen(false);
                }}
              >
                확인
              </Button>
            </span>
          </span>
        }
      >
        <div className="flex flex-wrap gap-sm" role="group" aria-label={frame.label}>
          {WEEKDAYS.map((day) => {
            const selected = pending.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setPending((current) =>
                    current.includes(day)
                      ? current.filter((entry) => entry !== day)
                      : [...current, day],
                  )
                }
                className={cn(
                  'size-(--spacing-control-md) rounded-pill text-subhead font-bold',
                  'transition-colors duration-(--motion-fast)',
                  selected
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface-sunken text-content-muted hover:bg-surface-raised hover:text-content',
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        {pending.length === WEEKDAYS.length ? (
          <p className="mt-md text-caption text-critical">
            이레를 모두 고르면 늘 닫혀 있는 곳이 됩니다. 어떤 일정에도 나오지 않습니다.
          </p>
        ) : null}
      </Sheet>
    </FieldFrame>
  );
}
