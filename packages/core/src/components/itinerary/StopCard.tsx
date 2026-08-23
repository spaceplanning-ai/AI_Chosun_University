'use client';

import { Clock, Footprints, Info, MapPin, Route } from 'lucide-react';
import { requireAttraction } from '../../data/attractions';
import { REGION_LABELS, SETTING_LABELS } from '../../domain/labels';
import type { ItineraryStop } from '../../domain/types/itinerary';
import { cn } from '../../lib/cn';
import { formatClock, formatDuration } from '../../lib/time';
import { AttractionMotifArt } from '../ui/AttractionMotifArt';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { REGION_TONE } from '../ui/tone';

/**
 * 일정의 방문지 카드.
 *
 * 제안서 6.4가 결과화면에 함께 표시하도록 요구한 항목을 모두 담는다 —
 * 예상 이동시간, 추천 체류시간, 실내·실외 구분, 걷기 난이도, 그리고 추천 근거로 가는 입구.
 */

/**
 * 카드가 실제로 읽는 필드만 추린 표시용 타입.
 *
 * QR로 넘어간 모바일 페이지에는 추천 근거가 실려 있지 않다(용량 때문에 관광지 id 만 보낸다).
 * 전체 `ItineraryStop` 을 요구하면 모바일이 빈 근거 객체를 지어내야 하므로,
 * 카드가 필요로 하는 최소 범위만 받는다.
 */
export type ItineraryStopView = Pick<
  ItineraryStop,
  'id' | 'attractionId' | 'startMinutes' | 'stayMinutes' | 'travelFromPreviousMinutes'
>;

export interface StopCardProps {
  stop: ItineraryStopView;
  /** 근거 보기 버튼을 눌렀을 때. 지정하지 않으면 버튼이 나타나지 않는다(모바일 요약 등). */
  onShowRationale?: () => void;
  /** 재구성으로 새로 들어온 방문지인지. 변경분을 눈에 띄게 표시한다. */
  changed?: boolean;
  compact?: boolean;
  className?: string;
}

export function StopCard({
  stop,
  onShowRationale,
  changed = false,
  compact = false,
  className,
}: StopCardProps) {
  const attraction = requireAttraction(stop.attractionId);

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-card bg-surface-card shadow-card surface-outline',
        changed && 'ring-2 ring-accent',
        className,
      )}
    >
      {changed ? (
        <span className="absolute top-sm right-sm z-10">
          <Badge tone="accent" variant="solid" size="sm">
            변경됨
          </Badge>
        </span>
      ) : null}

      <div className="flex">
        {!compact ? (
          <div className="w-[9rem] shrink-0 self-stretch">
            <AttractionMotifArt motif={attraction.motif} region={attraction.region} />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 p-md">
          <header className="flex flex-wrap items-center gap-xs">
            <span className="text-subhead font-bold text-accent" data-numeric="">
              {formatClock(stop.startMinutes)}
            </span>
            <Badge size="sm" tone={REGION_TONE[attraction.region]}>
              {REGION_LABELS[attraction.region]}
            </Badge>
            <Badge size="sm" tone="neutral">
              {attraction.district}
            </Badge>
          </header>

          <h3 className="mt-2xs text-heading font-bold text-content text-balance-safe">
            {attraction.name}
          </h3>
          <p className="mt-2xs text-body text-content-muted">{attraction.highlight}</p>

          <dl className="mt-sm flex flex-wrap gap-x-md gap-y-xs text-caption text-content-secondary">
            <div className="flex items-center gap-2xs">
              <Clock className="size-[1.1em] text-content-subtle" aria-hidden />
              <dt className="sr-only-text">추천 체류시간</dt>
              <dd data-numeric="">{formatDuration(stop.stayMinutes)} 체류</dd>
            </div>
            {stop.travelFromPreviousMinutes > 0 ? (
              <div className="flex items-center gap-2xs">
                <Route className="size-[1.1em] text-content-subtle" aria-hidden />
                <dt className="sr-only-text">직전 방문지에서의 이동시간</dt>
                <dd data-numeric="">이동 {formatDuration(stop.travelFromPreviousMinutes)}</dd>
              </div>
            ) : null}
            <div className="flex items-center gap-2xs">
              <Footprints className="size-[1.1em] text-content-subtle" aria-hidden />
              <dt className="sr-only-text">걷기 난이도</dt>
              <dd data-numeric="">보행부담 {attraction.walkingLoad}</dd>
            </div>
            <div className="flex items-center gap-2xs">
              <MapPin className="size-[1.1em] text-content-subtle" aria-hidden />
              <dt className="sr-only-text">실내·실외 구분</dt>
              <dd>{SETTING_LABELS[attraction.setting]}</dd>
            </div>
          </dl>

          {onShowRationale ? (
            <Button
              size="sm"
              variant="outline"
              iconLeft={Info}
              className="mt-sm"
              onClick={onShowRationale}
            >
              AI 추천 근거 보기
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
