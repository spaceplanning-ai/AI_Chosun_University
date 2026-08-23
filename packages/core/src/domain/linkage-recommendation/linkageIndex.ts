/**
 * 특허 후보 제1안 — 처리단계 6) 광주와 전남 관광지 사이의 초광역 연계지수를 산출하는 단계.
 *
 * 제안서 7.2의 원칙("광주와 전남을 무조건 각각 한 곳씩 포함하는 단순 규칙을 적용하지 않는다")을
 * 네 개의 구성요소로 분해해 구현한다.
 *
 *   지역 균형     두 지역이 얼마나 고르게 포함되었는가
 *   자원 상보성   두 지역이 서로 다른 성격의 자원을 기여하는가
 *   이동 효율     경계를 불필요하게 여러 번 넘나들지 않는가
 *   여정 연속성   연속한 방문지가 실제로 이어지는 동선인가
 *
 * 단순히 "광주 1 + 전남 1"이면 만점이 되는 구조가 아니라는 점이 이 지수의 핵심이며,
 * 특허 명세서에서 진보성을 설명할 때 그대로 인용할 수 있도록 각 요소가 독립적으로 계산된다.
 */

import { LINKAGE_WEIGHTS } from '../../config/scoring';
import { requireAttraction } from '../../data/attractions';
import { clampScore, roundTo } from '../../lib/number';
import { REGIONS } from '../types/catalog';
import type { Attraction, Region } from '../types/catalog';
import type { LinkageAssessment, LinkageComponentScore } from '../types/evidence';

/** 방문 순서를 유지한 관광지 목록. 순서가 이동 효율·연속성 계산에 쓰인다. */
type OrderedAttractions = readonly Attraction[];

function countByRegion(attractions: OrderedAttractions): Record<Region, number> {
  const counts = Object.fromEntries(REGIONS.map((region) => [region, 0])) as Record<Region, number>;
  for (const attraction of attractions) {
    counts[attraction.region] += 1;
  }
  return counts;
}

function scoreRegionBalance(counts: Record<Region, number>): LinkageComponentScore {
  const total = counts.gwangju + counts.jeonnam;
  const value =
    total === 0 ? 0 : clampScore((2 * Math.min(counts.gwangju, counts.jeonnam) * 100) / total);

  return {
    id: 'regionBalance',
    value: roundTo(value, 1),
    weight: LINKAGE_WEIGHTS.regionBalance,
    explanation:
      value === 0
        ? '한 지역의 관광지만 포함되어 초광역 연계가 성립하지 않습니다.'
        : `광주 ${counts.gwangju}곳 · 전남 ${counts.jeonnam}곳으로 구성되었습니다.`,
  };
}

function scoreResourceComplementarity(attractions: OrderedAttractions): LinkageComponentScore {
  const gwangjuCategories = new Set(
    attractions.filter((a) => a.region === 'gwangju').flatMap((a) => a.categories),
  );
  const jeonnamCategories = new Set(
    attractions.filter((a) => a.region === 'jeonnam').flatMap((a) => a.categories),
  );

  if (gwangjuCategories.size === 0 || jeonnamCategories.size === 0) {
    return {
      id: 'resourceComplementarity',
      value: 0,
      weight: LINKAGE_WEIGHTS.resourceComplementarity,
      explanation: '한쪽 지역의 자원이 없어 상보성을 계산할 수 없습니다.',
    };
  }

  const shared = [...gwangjuCategories].filter((category) => jeonnamCategories.has(category));
  const union = new Set([...gwangjuCategories, ...jeonnamCategories]);

  // 두 지역이 서로 다른 유형을 기여할수록(교집합이 작을수록) 상보성이 높다.
  const value = clampScore((1 - shared.length / union.size) * 100);

  return {
    id: 'resourceComplementarity',
    value: roundTo(value, 1),
    weight: LINKAGE_WEIGHTS.resourceComplementarity,
    explanation: `서로 다른 관광유형 ${union.size - shared.length}종을 각 지역이 나누어 기여합니다.`,
  };
}

function countCrossRegionTransitions(attractions: OrderedAttractions): number {
  let transitions = 0;
  for (let index = 1; index < attractions.length; index += 1) {
    const previous = attractions[index - 1];
    const current = attractions[index];
    if (previous && current && previous.region !== current.region) {
      transitions += 1;
    }
  }
  return transitions;
}

function scoreCorridorEfficiency(
  counts: Record<Region, number>,
  transitions: number,
): LinkageComponentScore {
  const bothRegionsPresent = counts.gwangju > 0 && counts.jeonnam > 0;

  if (!bothRegionsPresent) {
    return {
      id: 'corridorEfficiency',
      value: 0,
      weight: LINKAGE_WEIGHTS.corridorEfficiency,
      explanation: '지역 간 이동이 없어 이동 효율을 계산하지 않습니다.',
    };
  }

  // 두 지역을 모두 담으려면 경계를 최소 1회 넘어야 한다. 그보다 많이 넘을수록 감점.
  const minimumTransitions = 1;
  const value = clampScore((minimumTransitions / Math.max(transitions, minimumTransitions)) * 100);

  return {
    id: 'corridorEfficiency',
    value: roundTo(value, 1),
    weight: LINKAGE_WEIGHTS.corridorEfficiency,
    explanation:
      transitions <= minimumTransitions
        ? '지역 간 이동을 1회로 묶어 왕복 없이 이어집니다.'
        : `지역 경계를 ${transitions}회 넘나들어 이동 낭비가 있습니다.`,
  };
}

function scoreNarrativeContinuity(attractions: OrderedAttractions): LinkageComponentScore {
  if (attractions.length < 2) {
    return {
      id: 'narrativeContinuity',
      value: 0,
      weight: LINKAGE_WEIGHTS.narrativeContinuity,
      explanation: '방문지가 2곳 미만이라 연속성을 계산할 수 없습니다.',
    };
  }

  let connected = 0;
  const pairCount = attractions.length - 1;

  for (let index = 1; index < attractions.length; index += 1) {
    const previous = attractions[index - 1];
    const current = attractions[index];
    if (!previous || !current) continue;
    const isAdjacent =
      previous.adjacentIds.includes(current.id) || current.adjacentIds.includes(previous.id);
    const isSameDistrict = previous.district === current.district;
    if (isAdjacent || isSameDistrict) connected += 1;
  }

  const value = clampScore((connected / pairCount) * 100);

  return {
    id: 'narrativeContinuity',
    value: roundTo(value, 1),
    weight: LINKAGE_WEIGHTS.narrativeContinuity,
    explanation: `연속한 ${pairCount}개 구간 중 ${connected}개가 인접 자원으로 이어집니다.`,
  };
}

/** 방문 순서가 유지된 관광지 목록으로 초광역 연계지수를 산출한다. */
export function assessLinkage(attractions: OrderedAttractions): LinkageAssessment {
  const counts = countByRegion(attractions);
  const transitions = countCrossRegionTransitions(attractions);

  const components: LinkageComponentScore[] = [
    scoreRegionBalance(counts),
    scoreResourceComplementarity(attractions),
    scoreCorridorEfficiency(counts, transitions),
    scoreNarrativeContinuity(attractions),
  ];

  const totalWeight = components.reduce((total, component) => total + component.weight, 0);
  const score = clampScore(
    roundTo(
      components.reduce((total, component) => total + component.value * component.weight, 0) /
        totalWeight,
      1,
    ),
  );

  return { score, components, stopsByRegion: counts, crossRegionTransitions: transitions };
}

/** 관광지 id 목록으로 연계지수를 산출하는 편의 함수. */
export function assessLinkageByIds(attractionIds: readonly string[]): LinkageAssessment {
  return assessLinkage(attractionIds.map(requireAttraction));
}
