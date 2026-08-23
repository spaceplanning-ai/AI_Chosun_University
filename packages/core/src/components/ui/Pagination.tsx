'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * 게시판 쪽 넘김.
 *
 * ── 왜 한 화면에 다 안 뿌리는가 ────────────────────────────────────
 * 지금은 마흔 건이지만 자료는 늘기만 한다. 백 건이 한 줄로 이어지면
 * 표 아래에 있는 것(안내문·다음 카드)이 화면 밖으로 밀려 아무도 못 본다.
 * 쪽을 나누면 화면 길이가 자료 수와 무관해진다.
 *
 * ── 쪽 번호를 몇 개나 보여 줄 것인가 ───────────────────────────────
 * 지금 쪽 앞뒤로만 몇 개 두고 나머지는 «…»로 접는다.
 * 스무 쪽이면 번호 스무 개가 줄을 채워, 정작 «다음»을 누르기 어려워진다.
 */

export interface PaginationProps {
  /** 1부터 센다. 화면에 보이는 번호와 같게 두어야 헷갈리지 않는다. */
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}

/** 지금 쪽 양옆으로 보여 줄 번호 수. */
const WINDOW = 2;

/** 보여 줄 번호와 «…»의 자리를 정한다. */
function pageItems(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const items: (number | 'gap')[] = [1];
  const from = Math.max(2, page - WINDOW);
  const to = Math.min(pageCount - 1, page + WINDOW);

  if (from > 2) items.push('gap');
  for (let value = from; value <= to; value += 1) items.push(value);
  if (to < pageCount - 1) items.push('gap');

  items.push(pageCount);
  return items;
}

export function Pagination({ page, pageCount, onChange, className }: PaginationProps) {
  // 한 쪽뿐이면 넘길 것이 없다. 자리만 차지하는 조작줄을 두지 않는다.
  if (pageCount <= 1) return null;

  const step = (next: number) => onChange(Math.min(Math.max(next, 1), pageCount));

  const arrow = 'inline-flex size-control-sm items-center justify-center rounded-control';

  return (
    <nav
      aria-label="쪽 넘김"
      className={cn('flex flex-wrap items-center justify-center gap-2xs', className)}
    >
      <button
        type="button"
        onClick={() => step(page - 1)}
        disabled={page === 1}
        aria-label="이전 쪽"
        className={cn(
          arrow,
          'text-content-muted transition-colors duration-(--motion-fast)',
          'hover:bg-surface-sunken hover:text-content disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <ChevronLeft className="size-[1.1em]" aria-hidden />
      </button>

      {pageItems(page, pageCount).map((item, index) =>
        item === 'gap' ? (
          <span
            // 「…」는 앞뒤 어느 쪽의 생략인지에 따라 두 번 나올 수 있어 자리로 구분한다.
            key={`gap_${index}`}
            className="px-2xs text-caption text-content-subtle"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`${item}쪽`}
            className={cn(
              'inline-flex min-w-control-sm items-center justify-center rounded-control px-xs py-xs',
              'text-caption tabular-nums transition-colors duration-(--motion-fast)',
              item === page
                ? 'bg-accent font-bold text-on-accent'
                : 'font-semibold text-content-muted hover:bg-surface-sunken hover:text-content',
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => step(page + 1)}
        disabled={page === pageCount}
        aria-label="다음 쪽"
        className={cn(
          arrow,
          'text-content-muted transition-colors duration-(--motion-fast)',
          'hover:bg-surface-sunken hover:text-content disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <ChevronRight className="size-[1.1em]" aria-hidden />
      </button>
    </nav>
  );
}
