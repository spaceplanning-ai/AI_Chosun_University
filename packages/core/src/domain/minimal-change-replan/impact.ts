/**
 * 특허 후보 제2안 — 「변경이 필요한 장소/구간 식별」 단계 (피드백 5.2).
 *
 * 목표 지표를 기준으로 각 방문지가 얼마나 "문제의 원인"인지 정량화한다.
 * 전부 갈아엎지 않고 최소 개수만 바꾸려면, 먼저 어디를 건드려야 효과가 큰지
 * 순서를 매길 수 있어야 한다.
 */

import { requireAttraction } from '../../data/attractions';
import { clampScore, normalize, roundTo } from '../../lib/number';
import { flattenStops } from '../shared/metrics';
import type { Attraction } from '../types/catalog';
import type { ItineraryDay, ItineraryStop } from '../types/itinerary';
import type { RefinementObjective, StopImpact } from '../types/replan';

/** 이동시간 기여도를 0–100으로 옮길 때 쓰는 상한(분). */
const TRAVEL_CONTRIBUTION_CEILING = 120;

/** 실내·실외를 0–100 실내도로 환산. `shared/metrics` 와 같은 기준을 쓴다. */
const INDOOR_WEIGHT = { indoor: 100, mixed: 50, outdoor: 0 } as const;

/**
 * 이 방문지가 목표 지표를 얼마나 나쁘게 만들고 있는가 (0–100).
 * 값이 클수록 교체 1순위다.
 */
function contributionOf(
  attraction: Attraction,
  stop: ItineraryStop,
  objective: RefinementObjective,
): number {
  switch (objective.kind) {
    case 'metric':
      switch (objective.metric) {
        case 'walkingLoad':
          return attraction.walkingLoad;
        case 'costLevel':
          return attraction.costLevel;
        case 'indoorRatio':
          // 실내 비율을 올리고 싶다면 실외 장소가 원인이다.
          return 100 - INDOOR_WEIGHT[attraction.setting];
        case 'travelMinutes':
          return clampScore(
            normalize(stop.travelFromPreviousMinutes, 0, TRAVEL_CONTRIBUTION_CEILING) * 100,
          );
        case 'linkageScore':
          // 연계지수는 개별 방문지가 아니라 조합의 성질이므로 균등하게 본다.
          return 50;
      }
      break;
    case 'categoryShare':
      // 요청한 유형을 갖지 못한 방문지가 비율을 떨어뜨리는 원인이다.
      return attraction.categories.includes(objective.category) ? 0 : 100;
    case 'regionShare':
      return attraction.region === objective.region ? 0 : 100;
  }
  return 0;
}

/**
 * 방문지별 영향도를 계산해 내림차순으로 돌려준다.
 *
 * `projectedGain` 은 "이 한 곳을 이상적인 대안으로 바꿨을 때 목표 지표가 얼마나 움직이는가"의
 * 근사치다. 평균으로 계산되는 지표는 방문지 수로 나눈 만큼만 움직이므로 그 사실을 반영한다.
 * 실제 개선폭은 대체 후보를 넣어 지표를 다시 계산해 확정하며, 여기 값은 탐색 순서를 정하는 데만 쓴다.
 */
export function rankStopImpact(
  days: readonly ItineraryDay[],
  objective: RefinementObjective,
): StopImpact[] {
  const stops = flattenStops(days);
  if (stops.length === 0) return [];

  return stops
    .map((stop) => {
      const attraction = requireAttraction(stop.attractionId);
      const contribution = clampScore(contributionOf(attraction, stop, objective));
      return {
        stopId: stop.id,
        attractionId: stop.attractionId,
        contribution: roundTo(contribution, 1),
        projectedGain: roundTo(contribution / stops.length, 1),
      } satisfies StopImpact;
    })
    .sort((a, b) => b.contribution - a.contribution || a.stopId.localeCompare(b.stopId));
}
