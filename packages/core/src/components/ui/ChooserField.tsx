'use client';

import { useMemo, useState } from 'react';
import { Check, ListChecks } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { FieldFrame, ReadonlyValue, type FieldFrameProps, type SelectOption } from './Form';
import { Sheet } from './Sheet';

/**
 * 여럿을 고르는 칸 — 고르는 일은 창 안에서.
 *
 * ── 왜 창을 여는가 ─────────────────────────────────────────────────
 * 후보를 폼에 그대로 늘어놓으면 두 가지가 한꺼번에 나빠진다.
 *   · 고른 것이 안 고른 것들 사이에 묻힌다 (스물두 개 중 셋을 눈으로 찾아야 한다)
 *   · 폼이 길어져 그 아래 칸들이 화면 밖으로 밀린다
 * 폼에는 «고른 것»만 남기고, 고르는 일은 창을 열어 그 안에서 끝낸다.
 * 폼의 길이가 고른 개수에 따라만 변하고 후보 수와는 무관해진다.
 *
 * ── 왜 창 안에서 확인을 받는가 ─────────────────────────────────────
 * 여러 개를 켜고 끄다 보면 «어디까지 건드렸는지»를 잃는다.
 * 창을 닫기 전까지는 밖의 값이 그대로라, 취소하면 통째로 없던 일이 된다.
 */

export interface ChooserFieldProps extends Omit<FieldFrameProps, 'children'> {
  values: readonly string[];
  onChange: (values: string[]) => void;
  options: readonly SelectOption[];
  /** 하나도 안 고른 상태에 놓을 문구. */
  emptyLabel?: string;
  /** 이 수를 넘으면 창 안에 검색칸을 둔다. 여섯 개짜리 목록에 검색칸은 방해다. */
  searchThreshold?: number;
  readOnly?: boolean;
}

export function ChooserField({
  values,
  onChange,
  options,
  emptyLabel = '고르지 않음',
  searchThreshold = 10,
  readOnly = false,
  ...frame
}: ChooserFieldProps) {
  const [open, setOpen] = useState(false);
  /** 창 안에서 고르는 중인 값. 「확인」을 눌러야 밖으로 나간다. */
  const [pending, setPending] = useState<readonly string[]>([]);
  const [query, setQuery] = useState('');

  const chosen = options.filter((option) => values.includes(option.value));
  const pendingChosen = options.filter((option) => pending.includes(option.value));

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const chips = (list: readonly SelectOption[]) => (
    <span className="flex flex-wrap gap-xs">
      {list.map((option) => (
        <span
          key={option.value}
          className="inline-flex items-center rounded-pill bg-brand-soft px-sm py-2xs text-caption font-semibold text-brand-text"
        >
          {option.label}
        </span>
      ))}
    </span>
  );

  if (readOnly) {
    return (
      <FieldFrame {...frame} as="div">
        <ReadonlyValue>{chosen.length === 0 ? '' : chips(chosen)}</ReadonlyValue>
      </FieldFrame>
    );
  }

  const toggle = (value: string) =>
    setPending((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );

  return (
    <FieldFrame {...frame} as="div">
      <button
        type="button"
        aria-label={frame.label}
        onClick={() => {
          setPending([...values]);
          setQuery('');
          setOpen(true);
        }}
        className={cn(
          'flex min-h-control-sm w-full items-center gap-sm rounded-control bg-surface-card px-md py-xs text-caption surface-outline',
          'transition-colors duration-(--motion-fast) hover:bg-surface-sunken',
        )}
      >
        <span className="min-w-0 flex-1 text-start">
          {chosen.length === 0 ? (
            <span className="text-content-subtle">{emptyLabel}</span>
          ) : (
            chips(chosen)
          )}
        </span>
        <ListChecks className="size-[1.1em] shrink-0 text-content-subtle" aria-hidden />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        placement="center"
        title={`${frame.label} 고르기`}
        description={`${options.length}개 중 ${pending.length}개를 골랐습니다.`}
        footer={
          <span className="flex items-center justify-between gap-sm">
            <span className="min-w-0 flex-1 truncate text-caption text-content-muted">
              {pendingChosen.length === 0
                ? emptyLabel
                : pendingChosen.map((option) => option.label).join(' · ')}
            </span>
            <span className="flex shrink-0 gap-sm">
              <Button variant="quiet" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  // 자료의 순서를 따른다. 누른 차례대로 두면 같은 값이 화면마다 다르게 늘어선다.
                  onChange(options.filter((option) => pending.includes(option.value)).map((option) => option.value));
                  setOpen(false);
                }}
              >
                확인
              </Button>
            </span>
          </span>
        }
      >
        {options.length > searchThreshold ? (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름으로 좁히기"
            aria-label={`${frame.label} 찾기`}
            className="mb-md min-h-control-sm w-full rounded-control bg-surface-card px-md text-caption text-content surface-outline placeholder:text-content-subtle"
          />
        ) : null}

        <ul className="flex max-h-[22rem] flex-col gap-2xs overflow-y-auto" role="group" aria-label={frame.label}>
          {visible.length === 0 ? (
            <li className="px-md py-xs text-caption text-content-subtle">걸리는 것이 없습니다.</li>
          ) : (
            visible.map((option) => {
              const selected = pending.includes(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(option.value)}
                    className={cn(
                      'flex w-full items-center gap-sm rounded-control px-md py-sm text-start text-caption',
                      'transition-colors duration-(--motion-fast)',
                      selected
                        ? 'bg-brand-soft font-semibold text-brand-text'
                        : 'bg-surface-sunken text-content-muted hover:bg-surface-raised hover:text-content',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-[1.15em] shrink-0 items-center justify-center rounded-[0.25em]',
                        selected ? 'bg-brand text-on-brand' : 'bg-surface-card surface-outline',
                      )}
                    >
                      <Check className={cn('size-[0.9em]', selected ? '' : 'opacity-0')} aria-hidden />
                    </span>
                    {option.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </Sheet>
    </FieldFrame>
  );
}
