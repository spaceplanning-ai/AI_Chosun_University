import { Footprints, Gauge, House, MapPin, Route, ShieldCheck, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { COMPARABLE_METRICS, METRIC_DISPLAY, type ComparableMetric } from '../../domain/labels';
import type { ItineraryMetrics } from '../../domain/types/itinerary';
import type { MetricDelta } from '../../domain/types/replan';
import { cn } from '../../lib/cn';
import { Stat } from '../ui/Stat';
import { toneForScore, type Tone } from '../ui/tone';

/**
 * 일정 지표 요약.
 *
 * 변경 전/후 델타를 넘기면 같은 타일이 비교 모드로 바뀐다.
 * 결과화면과 재구성 비교화면이 서로 다른 컴포넌트를 쓰면
 * 같은 수치가 다르게 반올림되어 표시되는 사고가 난다.
 */

const METRIC_ICON: Record<ComparableMetric, LucideIcon> = {
  walkingLoad: Footprints,
  travelMinutes: Route,
  indoorRatio: House,
  costLevel: Wallet,
  stopCount: MapPin,
  averageTrust: ShieldCheck,
  linkageScore: Gauge,
};

/**
 * 값이 낮으면 «문제»인 지표만 신호등 색을 쓴다.
 *
 * 정보 신뢰도는 낮으면 실제로 나쁜 것이므로 빨강이 경고로 읽혀야 맞다.
 * 반면 **초광역 연계지수는 판정이 아니라 지수**다. 두 지역을 얼마나 엮었는지를
 * 0–100 으로 환산한 값이고 실제 일정은 대체로 50–65 사이에 떨어진다.
 * 여기에 「55 미만은 빨강」을 적용하면 정상적인 일정이 매번 경고로 표시된다 —
 * 아무 문제가 없는데 문제가 있다고 말하는 셈이다.
 * 그래서 연계지수는 이 제품의 대표 지표로서 강조색만 입힌다.
 */
const JUDGED_METRICS = new Set<ComparableMetric>(['averageTrust']);

function toneFor(metric: ComparableMetric, value: number): Tone {
  if (JUDGED_METRICS.has(metric)) return toneForScore(value);
  return metric === 'linkageScore' ? 'accent' : 'neutral';
}

export interface MetricSummaryProps {
  metrics: ItineraryMetrics;
  /** 지정하면 변경 전/후 비교로 렌더링한다. */
  deltas?: readonly MetricDelta[];
  /** 보여 줄 지표를 고른다. 키오스크는 넷, 연구자 화면은 전부. */
  visibleMetrics?: readonly ComparableMetric[];
  className?: string;
}

export function MetricSummary({
  metrics,
  deltas,
  visibleMetrics = COMPARABLE_METRICS,
  className,
}: MetricSummaryProps) {
  const deltaByKey = new Map(deltas?.map((delta) => [delta.key, delta]));

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
    >
      {visibleMetrics.map((metric) => {
        const display = METRIC_DISPLAY[metric];
        const delta = deltaByKey.get(metric);
        return (
          <Stat
            key={metric}
            // 판 밖에 단독으로 놓이는 줄이라 테두리가 있어야 덩어리로 읽힌다.
            surface="page"
            label={display.label}
            value={metrics[metric]}
            unit={display.unit}
            icon={METRIC_ICON[metric]}
            tone={toneFor(metric, metrics[metric])}
            delta={delta?.delta}
            direction={delta?.direction}
            hint={delta ? `변경 전 ${delta.before}${display.unit}` : undefined}
          />
        );
      })}
    </div>
  );
}
