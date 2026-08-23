import { GitCompareArrows } from 'lucide-react';
import { LINKAGE_COMPONENT_LABELS, REGION_LABELS } from '../../domain/labels';
import type { LinkageAssessment } from '../../domain/types/evidence';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/Badge';
import { Meter } from '../ui/Meter';
import { toneForScore } from '../ui/tone';

/**
 * 초광역 관광연계지수 내역.
 *
 * 이 화면이 제안서가 말하는 "광주와 전남이 얼마나 균형 있게 연결되었는지를 시각적으로 설명"에 해당한다.
 * 네 구성요소를 함께 보여 주는 이유는, 단순히 두 지역이 섞였다는 사실보다
 * "어떻게 섞였는가"가 이 지수의 핵심이기 때문이다.
 */

export interface LinkagePanelProps {
  linkage: LinkageAssessment;
  showComponents?: boolean;
  className?: string;
}

export function LinkagePanel({ linkage, showComponents = true, className }: LinkagePanelProps) {
  return (
    <div className={cn('flex flex-col gap-sm', className)}>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="flex items-center gap-xs text-label font-semibold text-content">
          <GitCompareArrows className="size-[1.2em] text-accent" aria-hidden />
          초광역 관광연계지수
        </span>
        <span className="flex gap-2xs">
          <Badge tone="gwangju">
            {REGION_LABELS.gwangju} {linkage.stopsByRegion.gwangju}곳
          </Badge>
          <Badge tone="jeonnam">
            {REGION_LABELS.jeonnam} {linkage.stopsByRegion.jeonnam}곳
          </Badge>
        </span>
      </div>

      <Meter
        label="종합 지수"
        value={linkage.score}
        tone={toneForScore(linkage.score)}
        description={`지역 경계를 ${linkage.crossRegionTransitions}회 넘는 일정입니다.`}
      />

      {showComponents ? (
        <ul className="flex flex-col gap-sm">
          {linkage.components.map((component) => (
            <li key={component.id}>
              <Meter
                size="sm"
                label={`${LINKAGE_COMPONENT_LABELS[component.id]} (가중치 ${component.weight})`}
                value={component.value}
                tone={toneForScore(component.value)}
                description={component.explanation}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
