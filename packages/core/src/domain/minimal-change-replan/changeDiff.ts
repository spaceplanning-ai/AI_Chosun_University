/**
 * 특허 후보 제2안 — 「이동시간·보행부담 등 변경 전/후 차이 계산」 단계 (피드백 5.2).
 *
 * 제안서 8.6의 결과 표현 예시("기존 보행부담 74 → 42 / 유지된 장소 3개 / 변경된 장소 1개")를
 * 그대로 만들어 내는 계층이다. 화면과 로그가 같은 함수를 쓴다.
 */

import { roundTo } from '../../lib/number';
import { COMPARABLE_METRICS, METRIC_DISPLAY } from '../labels';
import type { ItineraryDay, ItineraryMetrics } from '../types/itinerary';
import type { MetricDelta, RefinementObjective } from '../types/replan';
import { flattenStops } from '../shared/metrics';

/**
 * 지표별 변경 전/후 비교표.
 *
 * "개선/악화" 판정은 이용자가 무엇을 요청했는지에 달려 있다.
 * 실내 비율은 평소엔 중립 지표지만 "실내로 바꿔줘" 요청에서는 올라가야 개선이므로,
 * 목표 축에 해당하는 지표는 요청 방향으로, 나머지는 기본 방향으로 판정한다.
 */
export function buildMetricDeltas(
  before: ItineraryMetrics,
  after: ItineraryMetrics,
  objective: RefinementObjective,
): MetricDelta[] {
  return COMPARABLE_METRICS.map((key) => {
    const display = METRIC_DISPLAY[key];
    const delta = roundTo(after[key] - before[key], 1);

    const isTargetMetric = objective.kind === 'metric' && objective.metric === key;
    const betterWhen = isTargetMetric
      ? objective.direction === 'decrease'
        ? 'lower'
        : 'higher'
      : display.betterWhen;

    const direction: MetricDelta['direction'] =
      delta === 0
        ? 'unchanged'
        : betterWhen === 'neutral'
          ? 'neutral'
          : (betterWhen === 'lower') === delta < 0
            ? 'improved'
            : 'worsened';

    return {
      key,
      label: display.label,
      unit: display.unit,
      before: before[key],
      after: after[key],
      delta,
      direction,
    };
  });
}

export interface StopChangeSummary {
  keptStopIds: string[];
  changedStopIds: string[];
  /** 0–100 변화량 = 변경된 방문지 수 / 전체 방문지 수. */
  changeRatio: number;
}

/**
 * 유지된 장소와 변경된 장소를 가른다.
 * 방문지 id 가 관광지 id 에서 파생되므로, 같은 id 가 양쪽에 있으면 그대로 유지된 것이다.
 */
export function summarizeStopChanges(
  before: readonly ItineraryDay[],
  after: readonly ItineraryDay[],
): StopChangeSummary {
  const beforeIds = flattenStops(before).map((stop) => stop.id);
  const afterIds = new Set(flattenStops(after).map((stop) => stop.id));

  const keptStopIds = beforeIds.filter((id) => afterIds.has(id));
  const changedStopIds = beforeIds.filter((id) => !afterIds.has(id));

  return {
    keptStopIds,
    changedStopIds,
    changeRatio:
      beforeIds.length === 0 ? 0 : roundTo((changedStopIds.length / beforeIds.length) * 100, 1),
  };
}
