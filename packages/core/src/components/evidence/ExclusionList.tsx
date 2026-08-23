import { CircleX } from 'lucide-react';
import { getAttraction } from '../../data/attractions';
import { EXCLUSION_REASON_LABELS, EXCLUSION_STAGE_LABELS, REGION_LABELS } from '../../domain/labels';
import type { ExclusionRecord } from '../../domain/types/evidence';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/Badge';

/**
 * 제외 관광지와 사유.
 *
 * 피드백 3.2가 A안에 명시적으로 요청한 항목이며("추천 후보, 제외 후보 및 제외 이유"),
 * 설명가능성의 절반이 여기에 있다 — 무엇을 골랐는가만큼 무엇을 왜 뺐는가가 중요하다.
 */

export interface ExclusionListProps {
  exclusions: readonly ExclusionRecord[];
  /** 화면에 한 번에 보여 줄 최대 건수. 넘치면 나머지 개수를 알린다. */
  limit?: number;
  className?: string;
}

export function ExclusionList({ exclusions, limit, className }: ExclusionListProps) {
  if (exclusions.length === 0) {
    return (
      <p className="text-caption text-content-muted">
        이번 조건에서는 제외된 관광지가 없습니다.
      </p>
    );
  }

  const visible = limit === undefined ? exclusions : exclusions.slice(0, limit);
  const hiddenCount = exclusions.length - visible.length;

  return (
    <div className={cn('flex flex-col gap-xs', className)}>
      <ul className="flex flex-col gap-xs">
        {visible.map((exclusion, index) => {
          const attraction = getAttraction(exclusion.attractionId);
          return (
            <li
              key={`${exclusion.attractionId}-${exclusion.reason}-${index}`}
              className="rounded-card bg-surface-sunken p-sm surface-outline"
            >
              <div className="flex flex-wrap items-center gap-xs">
                <CircleX className="size-[1.1em] shrink-0 text-excluded" aria-hidden />
                <span className="text-label font-semibold text-content">
                  {attraction?.name ?? exclusion.attractionId}
                </span>
                {attraction ? (
                  <Badge size="sm" tone={attraction.region === 'gwangju' ? 'gwangju' : 'jeonnam'}>
                    {REGION_LABELS[attraction.region]}
                  </Badge>
                ) : null}
                <Badge size="sm" tone="excluded">
                  {EXCLUSION_REASON_LABELS[exclusion.reason]}
                </Badge>
                <Badge size="sm" tone="neutral">
                  {EXCLUSION_STAGE_LABELS[exclusion.stage]}
                </Badge>
              </div>
              <p className="mt-2xs text-caption leading-relaxed text-content-muted">
                {exclusion.detail}
              </p>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 ? (
        <p className="text-caption text-content-subtle" data-numeric="">
          외 {hiddenCount}건이 더 제외되었습니다. 전체 내역은 연구용 로그에서 확인할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
