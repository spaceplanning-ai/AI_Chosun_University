'use client';

import { cn } from '../../lib/cn';
import { TONE_FILL, type Tone } from './tone';

/**
 * 순위형 막대 목록.
 *
 * 대시보드의 항목 대부분이 "무엇이 얼마나 많은가"라는 같은 질문이므로 형태를 하나로 통일한다.
 *
 * ── 시각화 판단 ────────────────────────────────────────────────────
 * · 계열이 하나뿐이라 범례를 두지 않는다. 제목이 그 계열을 지칭한다.
 * · 계열이 하나이므로 색으로 항목을 구분하지 않는다 — 색은 강조에만 쓰고,
 *   항목의 정체성은 왼쪽 라벨이 가진다. 무지개색으로 칠하면 색이 의미를 갖는 것처럼
 *   잘못 읽힌다.
 * · 값을 막대 오른쪽에 직접 적는다. 항목 수가 적어 전부 적어도 읽기를 방해하지 않고,
 *   그 덕분에 별도의 표 보기가 필요 없다(색·길이 없이도 값이 전달된다).
 * · 막대 끝을 둥글게 처리하되 기준선에 붙여 시작점을 왜곡하지 않는다.
 * ──────────────────────────────────────────────────────────────────
 */

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** 값 뒤에 붙는 단위. */
  unit?: string;
  /** 막대 아래 보조 설명. */
  hint?: string;
  /** 항목별 색 지정. 지정하지 않으면 목록 전체가 한 색을 쓴다. */
  tone?: Tone;
}

export interface BarListProps {
  items: readonly BarListItem[];
  /** 목록 전체의 기본 색. */
  tone?: Tone;
  /** 막대 길이 기준값. 지정하지 않으면 최댓값을 100%로 잡는다. */
  max?: number;
  /** 안 주면 공통 문구를 쓴다. */
  emptyMessage?: string;
  className?: string;
}

export function BarList({
  items,
  tone = 'brand',
  max,
  emptyMessage,
  className,
}: BarListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-card bg-surface-sunken p-md text-caption text-content-muted surface-outline">
        {emptyMessage}
      </p>
    );
  }

  const ceiling = max ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className={cn('flex flex-col gap-sm', className)}>
      {items.map((item) => {
        const ratio = ceiling === 0 ? 0 : Math.min(1, item.value / ceiling);
        return (
          <li
            key={item.key}
            className="group rounded-control px-2xs py-2xs transition-colors duration-(--motion-fast) hover:bg-surface-sunken"
            title={`${item.label}: ${item.value}${item.unit ?? ''}`}
          >
            <div className="flex items-baseline justify-between gap-sm">
              <span className="min-w-0 truncate text-caption text-content-secondary">
                {item.label}
              </span>
              <span className="shrink-0 text-label font-bold text-content" data-numeric="">
                {item.value}
                {item.unit ? (
                  <span className="ml-[0.15em] text-caption font-medium text-content-muted">
                    {item.unit}
                  </span>
                ) : null}
              </span>
            </div>

            <div className="mt-2xs h-[0.5rem] w-full overflow-hidden rounded-pill bg-track">
              <div
                className={cn('h-full rounded-pill', TONE_FILL[item.tone ?? tone])}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>

            {item.hint ? (
              <p className="mt-2xs text-micro text-content-subtle">{item.hint}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
