/**
 * 일정 지표 계산.
 *
 * 제1안(생성)과 제2안(재구성)이 같은 함수를 쓴다.
 * 두 모듈이 각자 지표를 계산하면 "변경 전 74점 → 변경 후 42점" 같은 비교가
 * 서로 다른 정의 위에서 이루어져 무의미해지기 때문이다.
 */

import { requireAttraction } from '../../data/attractions';
import { average, clampScore, roundTo, sum } from '../../lib/number';
import { REGIONS } from '../types/catalog';
import type { Attraction, Region } from '../types/catalog';
import type { TrustAssessment } from '../types/evidence';
import type { ItineraryDay, ItineraryMetrics, ItineraryStop } from '../types/itinerary';
import { assessLinkage } from '../linkage-recommendation/linkageIndex';

/** 실내·실외 성격을 0–100 실내도로 환산한다. */
const INDOOR_WEIGHT = { indoor: 100, mixed: 50, outdoor: 0 } as const;

/** 일정 전체의 방문지를 방문 순서대로 편다. */
export function flattenStops(days: readonly ItineraryDay[]): ItineraryStop[] {
  return days.flatMap((day) => day.stops);
}

export function stopsToAttractions(stops: readonly ItineraryStop[]): Attraction[] {
  return stops.map((stop) => requireAttraction(stop.attractionId));
}

export function computeMetrics(
  days: readonly ItineraryDay[],
  trust: ReadonlyMap<string, TrustAssessment>,
): ItineraryMetrics {
  const stops = flattenStops(days);
  const attractions = stopsToAttractions(stops);

  const stopsByRegion = Object.fromEntries(REGIONS.map((region) => [region, 0])) as Record<
    Region,
    number
  >;
  for (const attraction of attractions) {
    stopsByRegion[attraction.region] += 1;
  }

  return {
    walkingLoad: roundTo(clampScore(average(attractions.map((a) => a.walkingLoad))), 1),
    travelMinutes: Math.round(sum(stops.map((stop) => stop.travelFromPreviousMinutes))),
    indoorRatio: roundTo(clampScore(average(attractions.map((a) => INDOOR_WEIGHT[a.setting]))), 1),
    costLevel: roundTo(clampScore(average(attractions.map((a) => a.costLevel))), 1),
    stopCount: stops.length,
    stopsByRegion,
    averageTrust: roundTo(
      clampScore(average(attractions.map((a) => trust.get(a.id)?.score ?? 0))),
      1,
    ),
    linkageScore: assessLinkage(attractions).score,
  };
}

/** 특정 관광유형이 일정에서 차지하는 비율(0–100). 재구성 목표 달성 판정에 쓴다. */
export function categoryShare(days: readonly ItineraryDay[], category: string): number {
  const attractions = stopsToAttractions(flattenStops(days));
  if (attractions.length === 0) return 0;
  const matching = attractions.filter((a) => a.categories.some((c) => c === category)).length;
  return roundTo((matching / attractions.length) * 100, 1);
}

/** 특정 지역이 일정에서 차지하는 비율(0–100). */
export function regionShare(days: readonly ItineraryDay[], region: Region): number {
  const attractions = stopsToAttractions(flattenStops(days));
  if (attractions.length === 0) return 0;
  return roundTo(
    (attractions.filter((a) => a.region === region).length / attractions.length) * 100,
    1,
  );
}
