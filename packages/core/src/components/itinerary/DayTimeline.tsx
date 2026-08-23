'use client';

import { REGION_LABELS } from '../../domain/labels';
import type { ItineraryDay, ItineraryStop } from '../../domain/types/itinerary';
import { cn } from '../../lib/cn';
import { dayLoadMinutes } from '../../domain/shared/scheduling';
import { formatDuration } from '../../lib/time';
import { Badge } from '../ui/Badge';
import { REGION_TONE } from '../ui/tone';
import { StopCard } from './StopCard';

/**
 * 하루치 일정 타임라인.
 *
 * 왼쪽 세로선은 단순 장식이 아니라 "이 방문지들이 하나의 하루로 이어진다"는
 * 정보를 전달한다. 일자 사이의 이동은 숙박을 전제로 하므로 선이 끊긴다.
 */

export interface DayTimelineProps {
  day: ItineraryDay;
  onShowRationale?: (stop: ItineraryStop) => void;
  /** 재구성으로 새로 들어온 방문지 id. */
  changedStopIds?: readonly string[];
  compact?: boolean;
  className?: string;
}

export function DayTimeline({
  day,
  onShowRationale,
  changedStopIds = [],
  compact = false,
  className,
}: DayTimelineProps) {
  const changed = new Set(changedStopIds);

  return (
    <section className={cn('flex flex-col gap-sm', className)} aria-label={day.title}>
      <header className="flex flex-wrap items-center justify-between gap-sm">
        <h3 className="text-title font-bold text-content">{day.title}</h3>
        <span className="flex items-center gap-2xs">
          <Badge tone={REGION_TONE[day.focusRegion]}>{REGION_LABELS[day.focusRegion]} 중심</Badge>
          <Badge tone="neutral">
            <span data-numeric="">{formatDuration(dayLoadMinutes(day))} 소요</span>
          </Badge>
        </span>
      </header>

      <ol className="relative flex flex-col gap-md ps-lg">
        {/* 타임라인 세로선 */}
        <span
          className="absolute inset-y-sm start-[0.55rem] w-[2px] rounded-pill bg-line-subtle"
          aria-hidden
        />
        {day.stops.map((stop) => (
          <li key={stop.id} className="relative">
            <span
              className={cn(
                'absolute start-[-1.1rem] top-md size-[0.75rem] rounded-pill ring-4 ring-surface-page',
                changed.has(stop.id) ? 'bg-accent' : 'bg-brand',
              )}
              aria-hidden
            />
            <StopCard
              stop={stop}
              onShowRationale={onShowRationale ? () => onShowRationale(stop) : undefined}
              changed={changed.has(stop.id)}
              compact={compact}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
