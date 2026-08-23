/**
 * 특허 후보 제2안 — 「기존 일정의 변화량을 최소화하는 재구성」 단계 (피드백 5.2).
 *
 * 이 파일이 제2안의 진보성이 놓인 자리다.
 * 조건이 바뀌었다고 일정을 새로 만들지 않고, 목표가 달성될 때까지
 * 영향도가 큰 방문지부터 한 곳씩만 교체한다. 목표가 달성되면 즉시 멈춘다.
 * 결과적으로 "유지된 장소"가 최대한 남으며, 이용자는 자기 일정이 통째로
 * 바뀌지 않았다는 것을 눈으로 확인할 수 있다.
 */

import { withParticle } from '../../lib/korean';
import { requireAttraction } from '../../data/attractions';
import { computeMetrics } from '../shared/metrics';
import type { TravelModel } from '../shared/scheduling';
import type { Attraction } from '../types/catalog';
import type { TrustAssessment } from '../types/evidence';
import type { ItineraryDay } from '../types/itinerary';
import type {
  ConstraintDelta,
  RefinementObjective,
  RejectedAlternative,
  StopImpact,
  StopReplacement,
} from '../types/replan';
import { isObjectiveImproved, objectiveValue } from './constraintChange';
import { rankStopImpact } from './impact';
import { findReplacement } from './replacementSearch';

/**
 * 한 번의 요청으로 바꿀 수 있는 방문지 수의 상한.
 * 이 값이 최소변경 원칙을 강제한다. 상한을 풀면 사실상 재생성이 되어
 * 제1안과 구분되지 않으므로, 목표를 못 이루더라도 여기서 멈춘다.
 */
export const MAX_REPLACEMENTS_PER_REQUEST = 2;

export interface MinimalChangeInput {
  days: readonly ItineraryDay[];
  objective: RefinementObjective;
  regionBias: ConstraintDelta['regionBias'];
  /** 조정된 조건벡터로 다시 거른 후보 풀. */
  eligible: readonly Attraction[];
  /** 하루 활동 가능시간(분). 교체본의 성립 여부를 판정하는 데 쓴다. */
  dailyCapacityMinutes: number;
  travelModel: TravelModel;
  trust: ReadonlyMap<string, TrustAssessment>;
}

export interface MinimalChangeResult {
  days: ItineraryDay[];
  impactRanking: StopImpact[];
  replacements: StopReplacement[];
  rejectedAlternatives: RejectedAlternative[];
  objectiveSatisfied: boolean;
}

/** 교체가 왜 그 후보로 결정되었는지를 수치와 함께 문장으로 남긴다. */
function describeReplacement(
  removed: Attraction,
  added: Attraction,
  similarity: number,
  metricGain: number,
  objective: RefinementObjective,
): string[] {
  const reasons = [
    `${withParticle(removed.name, '목적격')} ${withParticle(added.name, '방향격')} 교체했습니다.`,
    `관광가치 유사도 ${similarity}점으로 원래 일정의 성격을 유지합니다.`,
  ];

  switch (objective.kind) {
    case 'metric':
      reasons.push(
        `요청하신 지표가 ${metricGain.toFixed(1)}만큼 ${objective.direction === 'decrease' ? '감소' : '증가'}했습니다.`,
      );
      break;
    case 'categoryShare':
      reasons.push(`해당 관광유형의 비중이 ${metricGain.toFixed(1)}%p 늘었습니다.`);
      break;
    case 'regionShare':
      reasons.push(`해당 지역의 비중이 ${metricGain.toFixed(1)}%p 늘었습니다.`);
      break;
  }

  if (removed.walkingLoad !== added.walkingLoad) {
    reasons.push(`보행부담 ${removed.walkingLoad}점 → ${added.walkingLoad}점.`);
  }
  return reasons;
}

export function applyMinimalChange(input: MinimalChangeInput): MinimalChangeResult {
  const { objective, regionBias, eligible, dailyCapacityMinutes, travelModel, trust } = input;

  let days = input.days.map((day) => ({ ...day, stops: [...day.stops] }));
  const impactRanking = rankStopImpact(days, objective);
  const replacements: StopReplacement[] = [];
  const rejectedAlternatives: RejectedAlternative[] = [];

  const originalValue = objectiveValue(input.days, computeMetrics(input.days, trust), objective);

  for (const impact of impactRanking) {
    if (replacements.length >= MAX_REPLACEMENTS_PER_REQUEST) break;

    // 목표가 이미 달성되었으면 더 건드리지 않는다. 이것이 "최소" 변경의 실제 동작이다.
    const currentValue = objectiveValue(days, computeMetrics(days, trust), objective);
    if (isObjectiveImproved(originalValue, currentValue, objective)) break;

    // 기여도가 0인 방문지는 애초에 문제의 원인이 아니므로 교체 대상이 아니다.
    if (impact.contribution <= 0) continue;

    const inItinerary = new Set(days.flatMap((day) => day.stops).map((stop) => stop.attractionId));
    const candidates = eligible.filter((attraction) => !inItinerary.has(attraction.id));

    const { best, rejected } = findReplacement({
      days,
      stopId: impact.stopId,
      candidates,
      objective,
      regionBias,
      dailyCapacityMinutes,
      travelModel,
      trust,
    });
    rejectedAlternatives.push(...rejected);

    if (!best) continue;

    const removed = requireAttraction(impact.attractionId);
    days = best.resultingDays;
    replacements.push({
      removedStopId: impact.stopId,
      removedAttractionId: removed.id,
      addedAttractionId: best.attraction.id,
      similarity: best.similarity,
      metricGain: best.metricGain,
      reasons: describeReplacement(
        removed,
        best.attraction,
        best.similarity,
        best.metricGain,
        objective,
      ),
    });
  }

  const finalValue = objectiveValue(days, computeMetrics(days, trust), objective);

  return {
    days,
    impactRanking,
    replacements,
    rejectedAlternatives,
    objectiveSatisfied: isObjectiveImproved(originalValue, finalValue, objective),
  };
}
