'use client';

import { cn } from '../../lib/cn';
import { FieldFrame, ReadonlyValue, type FieldFrameProps } from './Form';

/**
 * 날짜 칸.
 *
 * ── 왜 여기서는 기본 입력을 쓰는가 ─────────────────────────────────
 * 다른 칸은 브라우저 기본 컨트롤을 피했다. 펼친 목록의 생김새가 운영체제마다
 * 달라 화면이 따로 놀기 때문이다. 날짜는 사정이 다르다 — 달력은 사람이 이미
 * 익숙한 물건이고, 직접 그리면 «이번 달 1일이 무슨 요일인지»부터 다시 만들어야 한다.
 * 칸 자체는 우리 테두리를 입히고, 달력만 브라우저에 맡긴다.
 *
 * 값은 언제나 `YYYY-MM-DD` 다. 자료에 적히는 형식과 같아 변환할 일이 없다.
 */

export interface DateFieldProps extends Omit<FieldFrameProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  /** 고를 수 있는 가장 이른·늦은 날. 비우면 제한이 없다. */
  min?: string;
  max?: string;
  readOnly?: boolean;
}

export function DateField({
  value,
  onChange,
  min,
  max,
  readOnly = false,
  ...frame
}: DateFieldProps) {
  if (readOnly) {
    return (
      <FieldFrame {...frame} as="div">
        <ReadonlyValue>{value}</ReadonlyValue>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame {...frame}>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={frame.error !== undefined}
        className={cn(
          'min-h-control-sm w-full rounded-control bg-surface-card px-md text-caption text-content surface-outline',
          'tabular-nums',
        )}
      />
    </FieldFrame>
  );
}
