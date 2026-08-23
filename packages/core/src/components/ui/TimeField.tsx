'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { FieldFrame, ReadonlyValue, type FieldFrameProps } from './Form';
import { Sheet } from './Sheet';

/**
 * 시각 칸.
 *
 * ── 왜 골라서 넣게 하는가 ──────────────────────────────────────────
 * 운영시간을 손으로 치면 「9:00」·「09시」·「오전 9시」가 뒤섞인다.
 * 자료 검증은 `HH:MM` 만 통과시키므로 그때마다 오류로 잡히고,
 * 잡히지 않고 지나간 표기는 일정 계산에서 조용히 어긋난다.
 * 골라서 넣으면 형식이 애초에 하나로 고정된다.
 *
 * ── 왜 `<input type="time">` 이 아닌가 ─────────────────────────────
 * 기본 시각 입력은 브라우저·운영체제마다 생김새가 다르고, 어떤 곳은
 * 12시간제(오전/오후)로 뜬다. 어드민의 다른 칸들과 눈에 띄게 따로 논다.
 */

/** 「09:00」 형태인가. 자료 검증이 보는 형식과 같다. */
const CLOCK_PATTERN = /^([01]\d|2[0-4]):([0-5]\d)$/;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const pad = (value: number) => String(value).padStart(2, '0');

export interface TimeFieldProps extends Omit<FieldFrameProps, 'children'> {
  /** 「HH:MM」. 비어 있거나 형식이 어긋나면 고르지 않은 것으로 본다. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 분 눈금. 운영시간은 5분 단위면 충분하다. */
  minuteStep?: number;
  /** 조회 상태. 값만 보여 주고 창을 열지 않는다. */
  readOnly?: boolean;
}

export function TimeField({
  value,
  onChange,
  placeholder = '눌러서 시각 고르기',
  minuteStep = 5,
  readOnly = false,
  ...frame
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  /** 창 안에서 고르는 중인 값. 「확인」을 눌러야 밖으로 나간다. */
  const [pending, setPending] = useState({ hour: 9, minute: 0 });

  const hourRef = useRef<HTMLButtonElement>(null);
  const minuteRef = useRef<HTMLButtonElement>(null);

  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => index * minuteStep);
  const matched = CLOCK_PATTERN.exec(value);

  // 창이 열리면 고른 자리가 보이도록 굴려 준다. 스물네 칸을 눈으로 찾게 두지 않는다.
  useEffect(() => {
    if (!open) return;
    hourRef.current?.scrollIntoView({ block: 'center' });
    minuteRef.current?.scrollIntoView({ block: 'center' });
  }, [open]);

  const openPicker = () => {
    setPending(
      matched
        ? { hour: Number(matched[1]), minute: Number(matched[2]) }
        : { hour: 9, minute: 0 },
    );
    setOpen(true);
  };

  const column = (
    label: string,
    items: number[],
    selected: number,
    onPick: (item: number) => void,
    ref: React.RefObject<HTMLButtonElement | null>,
  ) => (
    <div className="flex min-w-0 flex-1 flex-col gap-2xs">
      <span className="text-micro font-semibold text-content-muted">{label}</span>
      <div
        role="listbox"
        aria-label={label}
        className="scrollable-y h-[14rem] rounded-card bg-surface-sunken p-2xs"
      >
        {items.map((item) => {
          const current = item === selected;
          return (
            <button
              key={item}
              ref={current ? ref : undefined}
              type="button"
              role="option"
              aria-selected={current}
              onClick={() => onPick(item)}
              className={cn(
                'w-full rounded-control py-xs text-center text-caption tabular-nums',
                'transition-colors duration-(--motion-fast)',
                current
                  ? 'bg-accent font-bold text-on-accent'
                  : 'font-semibold text-content-muted hover:bg-surface-raised hover:text-content',
              )}
            >
              {pad(item)}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (readOnly) {
    return (
      <FieldFrame {...frame} as="div">
        <ReadonlyValue>{matched ? value : ''}</ReadonlyValue>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame {...frame} as="div">
      <button
        type="button"
        aria-label={frame.label}
        onClick={openPicker}
        className={cn(
          'inline-flex min-h-control-sm w-full items-center gap-xs rounded-control bg-surface-card px-md text-caption surface-outline',
          'transition-colors duration-(--motion-fast) hover:bg-surface-sunken',
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-start tabular-nums',
            matched ? 'font-semibold text-content' : 'text-content-subtle',
          )}
        >
          {matched ? value : placeholder}
        </span>
        <Clock className="size-[1.1em] shrink-0 text-content-subtle" aria-hidden />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        placement="center"
        title={`${frame.label} 고르기`}
        description="24시간제로 적습니다. 자정 넘어까지 여는 곳은 24:00 으로 두세요."
        footer={
          <span className="flex items-center justify-between gap-sm">
            <strong className="text-title font-bold tabular-nums text-content">
              {pad(pending.hour)}:{pad(pending.minute)}
            </strong>
            <span className="flex gap-sm">
              <Button variant="quiet" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  onChange(`${pad(pending.hour)}:${pad(pending.minute)}`);
                  setOpen(false);
                }}
              >
                확인
              </Button>
            </span>
          </span>
        }
      >
        <div className="flex gap-md">
          {column('시', HOURS, pending.hour, (hour) => setPending((current) => ({ ...current, hour })), hourRef)}
          {column(
            '분',
            minutes,
            pending.minute,
            (minute) => setPending((current) => ({ ...current, minute })),
            minuteRef,
          )}
        </div>
      </Sheet>
    </FieldFrame>
  );
}
