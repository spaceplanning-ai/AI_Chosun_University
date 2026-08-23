'use client';

import type { ItineraryDay } from '../../domain/types/itinerary';
import { cn } from '../../lib/cn';

/**
 * 일자 선택 레일 (제안서 6.3 결과화면).
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 3일 이상을 고르면 방문지가 15곳까지 늘어난다. 그걸 한 줄로 이어 붙이면
 * 결과화면이 화면 다섯 개 높이가 되고, 관람객은 **스크롤만 하다가 끝을 못 본다.**
 * 전시장 키오스크에서는 스크롤이 길수록 이탈이 는다 — 뒤에 사람이 서 있기 때문이다.
 *
 * 그래서 일자를 탭으로 접는다. 아코디언이 아니라 탭인 이유는,
 * 아코디언은 «지금 몇 개가 열려 있는지»를 관람객이 관리해야 하지만
 * 탭은 언제나 하나만 보이므로 관리할 상태가 없기 때문이다.
 *
 * 「전체」를 맨 앞에 두는 이유는, 하루씩 보는 것이 기본이되
 * 여정 전체를 훑고 싶은 사람의 길도 막지 않기 위함이다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 「전체」를 나타내는 값. 일자 번호와 섞이지 않도록 숫자가 아닌 값을 쓴다. */
export const ALL_DAYS = 'all' as const;

export type DaySelection = typeof ALL_DAYS | number;

export interface DayRailProps {
  days: readonly ItineraryDay[];
  selected: DaySelection;
  onSelect: (selection: DaySelection) => void;
  className?: string;
}

export function DayRail({ days, selected, onSelect, className }: DayRailProps) {
  // 하루짜리 일정에는 고를 것이 없다. 탭 하나만 덩그러니 두면 누를 수 있는 것처럼 보여 혼란스럽다.
  if (days.length <= 1) return null;

  const totalStops = days.reduce((sum, day) => sum + day.stops.length, 0);

  const tabClass = (isActive: boolean) =>
    cn(
      'flex min-h-control-md shrink-0 flex-col items-start justify-center gap-2xs rounded-control px-lg text-left',
      'transition-colors duration-(--motion-fast)',
      isActive ? 'district-selected' : 'bg-surface-card text-content surface-outline',
    );

  return (
    <div
      role="tablist"
      aria-label="일자 선택"
      className={cn('flex gap-xs overflow-x-auto pb-2xs', className)}
    >
      <button
        type="button"
        role="tab"
        aria-selected={selected === ALL_DAYS}
        onClick={() => onSelect(ALL_DAYS)}
        className={tabClass(selected === ALL_DAYS)}
      >
        <span className="text-label font-bold">전체 일정</span>
        <span className="text-micro opacity-80">
          <span data-numeric="">{days.length}</span>일 · 방문지{' '}
          <span data-numeric="">{totalStops}</span>곳
        </span>
      </button>

      {days.map((day) => {
        const isActive = selected === day.dayIndex;
        return (
          <button
            key={day.dayIndex}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(day.dayIndex)}
            className={tabClass(isActive)}
          >
            <span className="text-label font-bold">
              <span data-numeric="">{day.dayIndex + 1}</span>일차
            </span>
            <span className="text-micro opacity-80">
              방문지 <span data-numeric="">{day.stops.length}</span>곳
            </span>
          </button>
        );
      })}
    </div>
  );
}
