/**
 * 특허 후보 제2안 — 「대체 후보 탐색 및 적합성 평가」 단계 (피드백 5.2).
 *
 * 핵심 판단 두 가지를 한곳에서 내린다.
 *   ① 이 후보가 목표 지표를 실제로 개선하는가 → 지표를 다시 계산해 확인한다(추정하지 않는다)
 *   ② 원래 장소와 관광가치가 비슷한가       → 유사도가 낮으면 "최소변경"이 아니라 "다른 여행"이 된다
 *
 * 탈락한 후보도 사유와 함께 반환한다. 무엇을 검토했고 왜 안 골랐는지가
 * 남아야 재구성 결과를 설명할 수 있기 때문이다.
 */

import { requireAttraction } from '../../data/attractions';
import { clampScore, roundTo } from '../../lib/number';
import { parseClock } from '../../lib/time';
import { computeMetrics } from '../shared/metrics';
import { dayLoadMinutes, retimeDays, type TravelModel } from '../shared/scheduling';
import type { Attraction, Region } from '../types/catalog';
import type { TrustAssessment } from '../types/evidence';
import type { ItineraryDay } from '../types/itinerary';
import type { ConstraintDelta, RefinementObjective, RejectedAlternative } from '../types/replan';
import { objectiveGain, objectiveValue } from './constraintChange';

/** 유사도 배점. 합계 100. */
const SIMILARITY_WEIGHTS = {
  category: 55,
  audience: 20,
  region: 15,
  setting: 10,
} as const;

/** 이 유사도 미만이면 "성격이 다른 여행"으로 보고 교체하지 않는다. */
export const MINIMUM_SIMILARITY = 24;

/** 후보 순위 = 목표 개선폭과 유사도의 가중합. 개선을 우선하되 성격 보존도 함께 본다. */
const RANKING_WEIGHTS = { objectiveGain: 0.62, similarity: 0.38 } as const;

function overlapRatio<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 1;
  const shared = a.filter((value) => b.includes(value)).length;
  return shared / union.size;
}

/** 관광가치 유사도 0–100. 유형·대상·지역·실내외 성격을 함께 본다. */
export function tourismSimilarity(from: Attraction, to: Attraction): number {
  const category = overlapRatio(from.categories, to.categories) * SIMILARITY_WEIGHTS.category;
  const audience = overlapRatio(from.audiences, to.audiences) * SIMILARITY_WEIGHTS.audience;
  const region = (from.region === to.region ? 1 : 0) * SIMILARITY_WEIGHTS.region;
  const setting = (from.setting === to.setting ? 1 : 0) * SIMILARITY_WEIGHTS.setting;
  return roundTo(clampScore(category + audience + region + setting), 1);
}

export interface ReplacementSearchInput {
  days: readonly ItineraryDay[];
  /** 교체 대상 방문지. */
  stopId: string;
  /** 교체 후보 풀. 이미 일정에 포함된 곳은 호출 측에서 걸러 둔다. */
  candidates: readonly Attraction[];
  objective: RefinementObjective;
  /** 지역 편향 가산점. 조건벡터가 아니라 여기서 반영한다. */
  regionBias: ConstraintDelta['regionBias'];
  /** 하루 활동 가능시간(분). 교체본이 이 시간을 넘기면 성립하지 않는 일정이다. */
  dailyCapacityMinutes: number;
  travelModel: TravelModel;
  trust: ReadonlyMap<string, TrustAssessment>;
}

export interface ReplacementOption {
  attraction: Attraction;
  similarity: number;
  /** 목표 지표의 실제 개선폭. 지표를 다시 계산해 얻는다. */
  metricGain: number;
  /** 교체를 적용하고 시각까지 재계산한 일정. */
  resultingDays: ItineraryDay[];
  rankingScore: number;
}

export interface ReplacementSearchResult {
  best?: ReplacementOption;
  rejected: RejectedAlternative[];
}

/** 대상 방문지를 후보로 갈아 끼운 일정을 만든다. 시각 재계산은 호출 측에서 수행한다. */
function swapStop(
  days: readonly ItineraryDay[],
  stopId: string,
  replacement: Attraction,
): ItineraryDay[] {
  return days.map((day) => ({
    ...day,
    stops: day.stops.map((stop) =>
      stop.id === stopId
        ? {
            ...stop,
            id: `stop-${replacement.id}`,
            attractionId: replacement.id,
            stayMinutes: replacement.averageStayMinutes,
          }
        : stop,
    ),
  }));
}

/**
 * 교체를 반영한 일정이 실제로 성립하는지 검사한다.
 *
 * 목표 지표만 보고 고르면 "실내로 바꿔줘" 한 마디에 담양 일정이 목포로 날아가
 * 총 이동시간이 두 배가 되는 결과가 나온다. 지표는 개선되었지만 갈 수 없는 여행이다.
 * 따라서 교체본을 실제로 재계산해 운영시간과 하루 활동시간을 함께 확인한다.
 *
 * 위반이 없으면 `undefined`, 있으면 이용자에게 보여 줄 수 있는 사유 문장을 돌려준다.
 */
function findScheduleViolation(
  retimedDays: readonly ItineraryDay[],
  dailyCapacityMinutes: number,
): string | undefined {
  for (const day of retimedDays) {
    for (const stop of day.stops) {
      const attraction = requireAttraction(stop.attractionId);
      const endsAt = stop.startMinutes + stop.stayMinutes;
      if (endsAt > parseClock(attraction.openingHours.close)) {
        return `${day.dayIndex + 1}일차에서 ${attraction.name}의 관람 종료가 운영 종료 ${attraction.openingHours.close}를 넘깁니다.`;
      }
    }

    const load = dayLoadMinutes(day);
    if (load > dailyCapacityMinutes) {
      return `${day.dayIndex + 1}일차 소요시간이 ${Math.round(load)}분으로 하루 활동 가능시간 ${dailyCapacityMinutes}분을 초과합니다.`;
    }
  }
  return undefined;
}

function regionBonus(region: Region, bias: ConstraintDelta['regionBias']): number {
  return bias?.[region] ?? 0;
}

/**
 * 한 방문지에 대한 최적 대체 후보를 찾는다.
 * 후보마다 실제로 일정을 갈아 끼워 지표를 다시 계산하므로, 개선폭은 추정치가 아니라 확정값이다.
 */
export function findReplacement(input: ReplacementSearchInput): ReplacementSearchResult {
  const { days, stopId, candidates, objective, regionBias, dailyCapacityMinutes, travelModel, trust } =
    input;

  const targetStop = days.flatMap((day) => day.stops).find((stop) => stop.id === stopId);
  if (!targetStop) return { rejected: [] };

  const original = requireAttraction(targetStop.attractionId);
  const baseline = objectiveValue(days, computeMetrics(days, trust), objective);

  const rejected: RejectedAlternative[] = [];
  const options: ReplacementOption[] = [];

  for (const candidate of candidates) {
    const similarity = tourismSimilarity(original, candidate);

    const resultingDays = retimeDays(swapStop(days, stopId, candidate), travelModel);

    const violation = findScheduleViolation(resultingDays, dailyCapacityMinutes);
    if (violation) {
      rejected.push({
        forStopId: stopId,
        attractionId: candidate.id,
        reason: violation,
        similarity,
        metricGain: 0,
      });
      continue;
    }

    const metricGain = roundTo(
      objectiveGain(
        baseline,
        objectiveValue(resultingDays, computeMetrics(resultingDays, trust), objective),
        objective,
      ),
      1,
    );

    if (metricGain <= 0) {
      rejected.push({
        forStopId: stopId,
        attractionId: candidate.id,
        reason: '요청한 방향으로 지표가 개선되지 않습니다.',
        similarity,
        metricGain,
      });
      continue;
    }

    if (similarity < MINIMUM_SIMILARITY) {
      rejected.push({
        forStopId: stopId,
        attractionId: candidate.id,
        reason: `관광가치 유사도 ${similarity}점으로 기준 ${MINIMUM_SIMILARITY}점에 미달해 일정 성격이 달라집니다.`,
        similarity,
        metricGain,
      });
      continue;
    }

    options.push({
      attraction: candidate,
      similarity,
      metricGain,
      resultingDays,
      rankingScore: roundTo(
        metricGain * RANKING_WEIGHTS.objectiveGain +
          similarity * RANKING_WEIGHTS.similarity +
          regionBonus(candidate.region, regionBias),
        2,
      ),
    });
  }

  options.sort(
    (a, b) => b.rankingScore - a.rankingScore || a.attraction.id.localeCompare(b.attraction.id),
  );

  const [best, ...runnersUp] = options;
  for (const option of runnersUp) {
    rejected.push({
      forStopId: stopId,
      attractionId: option.attraction.id,
      reason: `채택안보다 종합점수가 낮습니다 (개선 ${option.metricGain} / 유사도 ${option.similarity}).`,
      similarity: option.similarity,
      metricGain: option.metricGain,
    });
  }

  return { best, rejected };
}
