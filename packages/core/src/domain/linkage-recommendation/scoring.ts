/**
 * 특허 후보 제1안 — 처리단계 7) 취향 적합도, 이동부담 및 연계지수를 반영해 일정을 생성하는 단계 중
 * "후보별 다목적 추천점수 산출" 부분.
 *
 * 제안서 8.4의 7개 평가항목을 각각 독립 함수로 구현한다.
 * 항목별 원점수와 가중 기여분을 모두 남기므로, 결과화면의 "AI 추천 근거"와
 * 연구자 화면의 점수표가 같은 계산에서 나온다.
 *
 * 주목할 점: `regionLinkage` 는 별도 휴리스틱이 아니라
 * "이 후보를 넣었을 때 초광역 연계지수가 얼마나 올라가는가"라는 한계기여로 정의된다.
 * 연계지수 모듈과 추천점수 모듈이 같은 지표를 공유하므로 두 값이 어긋날 수 없다.
 */

import { MAX_STOPS_PER_CATEGORY, SCORE_WEIGHTS } from '../../config/scoring';
import { blend, clampScore, normalize, roundTo, sum, toRatio } from '../../lib/number';
import { travelMinutesBetween, travelMinutesFromGateway } from '../shared/scheduling';
import type { Attraction, Region } from '../types/catalog';
import type { CandidateScore, CriterionScore, TrustAssessment } from '../types/evidence';
import type { ConditionVector, TravelConditions } from '../types/travel';
import { assessLinkage } from './linkageIndex';

export interface ScoringContext {
  vector: ConditionVector;
  conditions: TravelConditions;
  /** 지금까지 확정된 방문지. 순서를 유지해야 연계지수 한계기여가 정확해진다. */
  selected: readonly Attraction[];
  /** 이 날 일정의 중심 지역. */
  focusRegion: Region;
  /** 직전 방문지. 없으면 도착 관문에서 출발하는 것으로 본다. */
  previous?: Attraction;
  /**
   * 이 후보가 그 날의 첫 방문지인가.
   * 첫 방문지는 그 날 전체의 지리적 무게중심을 결정하므로 이동 감점을 더 강하게 건다.
   */
  isDayOpening: boolean;
  trust: ReadonlyMap<string, TrustAssessment>;
}

/** 이동시간이 이 구간을 벗어나면 감점이 포화된다(분). */
const LEG_MINUTES_RANGE = { comfortable: 12, punishing: 105 } as const;

/** 하루의 첫 방문지에 적용하는 이동 감점 배율. */
const DAY_OPENING_LEG_MULTIPLIER = 1.6;

/** 취향 적합도 정규화 기준: 상위 3개 관심 가중치의 합. 관광지 하나가 가질 만한 최대 매칭량이다. */
function preferenceReference(vector: ConditionVector): number {
  const sorted = Object.values(vector.interestWeights).sort((a, b) => b - a);
  const top = sorted.slice(0, 3);
  return sum(top) || 1;
}

function scorePreferenceFit(attraction: Attraction, context: ScoringContext): number {
  const { vector, conditions } = context;
  const matched = sum(attraction.categories.map((category) => vector.interestWeights[category]));
  const base = (matched / preferenceReference(vector)) * 100;
  const audienceBonus = attraction.audiences.includes(conditions.companion) ? 8 : -6;
  return clampScore(base + audienceBonus);
}

function scoreTravelFeasibility(attraction: Attraction, context: ScoringContext): number {
  const { vector, focusRegion, previous } = context;

  // 대중교통 의존도가 높은데 접근성이 낮은 곳은 실제로 갈 수 없는 일정이 된다.
  const transitPenalty = toRatio(vector.transitDependency) * (100 - attraction.transitAccess) * 0.55;

  // 하루 활동시간의 절반 이상을 한 곳이 차지하면 나머지 일정이 무너진다.
  const stayBudget = vector.dailyCapacityMinutes * 0.45;
  const stayPenalty = Math.max(0, attraction.averageStayMinutes - stayBudget) * 0.28;

  // 직전 위치에서 실제로 얼마나 떨어져 있는가. 이 항이 없으면 목포 다음에 여수를 넣는
  // 지리적으로 불가능한 일정이 점수상으로는 멀쩡해 보인다.
  const legMinutes = previous
    ? travelMinutesBetween(previous, attraction, vector)
    : travelMinutesFromGateway(attraction, vector);
  const legPenalty =
    normalize(legMinutes, LEG_MINUTES_RANGE.comfortable, LEG_MINUTES_RANGE.punishing) *
    (40 + toRatio(vector.compactnessDemand) * 35) *
    (context.isDayOpening ? DAY_OPENING_LEG_MULTIPLIER : 1);

  // 그 날의 중심 지역을 벗어나면 일자별 서사가 흐려진다. 거리 항이 주된 억제력이므로 가볍게만 반영한다.
  const offFocusPenalty = attraction.region === focusRegion ? 0 : 8;

  return clampScore(100 - transitPenalty - stayPenalty - legPenalty - offFocusPenalty);
}

function scoreRegionLinkage(attraction: Attraction, context: ScoringContext): number {
  const current = assessLinkage(context.selected).score;
  const projected = assessLinkage([...context.selected, attraction]).score;
  // 한계기여를 0–100으로 옮긴다. 50점이 "연계지수를 그대로 유지"에 해당한다.
  return clampScore(50 + (projected - current) * 2.2);
}

function scoreResourceDiversity(attraction: Attraction, context: ScoringContext): number {
  const overlapping = context.selected.filter((selected) =>
    selected.categories.some((category) => attraction.categories.includes(category)),
  ).length;

  const saturatedCategories = attraction.categories.filter((category) => {
    const used = context.selected.filter((selected) =>
      selected.categories.includes(category),
    ).length;
    return used >= MAX_STOPS_PER_CATEGORY;
  }).length;

  return clampScore(100 - overlapping * 24 - saturatedCategories * 22);
}

function scoreAccessibilityFit(attraction: Attraction, context: ScoringContext): number {
  const { vector } = context;

  const walkingPenalty = Math.max(0, attraction.walkingLoad - vector.walkingTolerance) * 1.15;
  let value = 100 - walkingPenalty;

  value = blend(value, attraction.seniorScore, toRatio(vector.seniorConsideration));
  value = blend(value, attraction.familyScore, toRatio(vector.childConsideration));

  // 실내 선호가 50에서 멀어질수록 실내·실외 성격을 강하게 반영한다.
  const settingScore = attraction.setting === 'indoor' ? 100 : attraction.setting === 'mixed' ? 62 : 18;
  const indoorIntent = (vector.indoorPreference - 50) / 50;
  const settingTarget = indoorIntent >= 0 ? settingScore : 100 - settingScore;
  value = blend(value, settingTarget, Math.abs(indoorIntent) * 0.6);

  return clampScore(value);
}

function scoreRegionalDispersion(attraction: Attraction, context: ScoringContext): number {
  const districtUsed = context.selected.some(
    (selected) => selected.district === attraction.district,
  );
  const novelty = districtUsed ? 45 : 100;
  // 접근성이 높은 유명 거점일수록 이미 방문수요가 집중되어 있다고 본다.
  const dispersal = 100 - attraction.transitAccess * 0.3;
  return clampScore(blend(novelty, dispersal, 0.35));
}

const CRITERION_SCORERS = {
  preferenceFit: scorePreferenceFit,
  travelFeasibility: scoreTravelFeasibility,
  regionLinkage: scoreRegionLinkage,
  resourceDiversity: scoreResourceDiversity,
  accessibilityFit: scoreAccessibilityFit,
  informationTrust: (attraction: Attraction, context: ScoringContext) =>
    context.trust.get(attraction.id)?.score ?? 0,
  regionalDispersion: scoreRegionalDispersion,
} as const satisfies Record<
  keyof typeof SCORE_WEIGHTS,
  (attraction: Attraction, context: ScoringContext) => number
>;

/** 후보 하나의 다목적 추천점수를 산출한다. rank 는 순위 매김 단계에서 채워진다. */
export function scoreCandidate(attraction: Attraction, context: ScoringContext): CandidateScore {
  const criteria: CriterionScore[] = (
    Object.keys(CRITERION_SCORERS) as (keyof typeof CRITERION_SCORERS)[]
  ).map((id) => {
    const raw = roundTo(CRITERION_SCORERS[id](attraction, context), 1);
    const weight = SCORE_WEIGHTS[id];
    return { id, raw, weight, weighted: roundTo((raw * weight) / 100, 2) };
  });

  return {
    attractionId: attraction.id,
    total: roundTo(
      criteria.reduce((accumulated, criterion) => accumulated + criterion.weighted, 0),
      1,
    ),
    criteria,
    trustScore: context.trust.get(attraction.id)?.score ?? 0,
    rank: 0,
  };
}

/** 후보 전체를 채점하고 총점 내림차순으로 순위를 매긴다. */
export function rankCandidates(
  attractions: readonly Attraction[],
  context: ScoringContext,
): CandidateScore[] {
  return attractions
    .map((attraction) => scoreCandidate(attraction, context))
    .sort((a, b) => b.total - a.total || a.attractionId.localeCompare(b.attractionId))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
