/**
 * 비교 테스트 모드 — 일반 추천 방식 대 제안 알고리즘.
 *
 * 피드백 7.1이 "가능 여부 별도 회신"으로 남겨 둔 항목
 * ("일반 RAG/추천과 제안 알고리즘을 비교할 수 있는 테스트 모드")에 대한 구현이다.
 *
 * 두 곳에 동시에 쓰인다.
 *   · 특허 — 제안 방식이 통상의 방식과 무엇이 다른지 수치로 보이는 진보성 근거
 *   · 논문 — 제안서 10.2 "일반 관광지 목록과 AI 맞춤일정의 방문의도 차이 비교"의 자극물
 *
 * ── 해석상의 한계를 먼저 밝힌다 ────────────────────────────────────
 * 여기의 비교군은 **외부 벤치마크가 아니라 본 저장소가 정의한 대조 구현**이다.
 * 통상적인 관광안내 서비스의 동작을 모사한 것이며, 특정 상용 제품과의 성능 비교가 아니다.
 * 대조군 정의는 아래 `BASELINES` 에 전부 공개되어 있으므로, 검수자가 정의 자체의
 * 타당성을 검토한 뒤 결과를 해석하면 된다.
 * ──────────────────────────────────────────────────────────────────
 */

import { SCHEDULING, TRUST_THRESHOLDS } from '../../config/scoring';
import { ATTRACTIONS, requireAttraction } from '../../data/attractions';
import { getDocumentsFor } from '../../data/officialDocuments';
import { average, roundTo, sum } from '../../lib/number';
import { parseClock } from '../../lib/time';
import { buildConditionVector } from '../linkage-recommendation/conditionVector';
import { generateItinerary } from '../linkage-recommendation/index';
import { assessTrustForAll } from '../linkage-recommendation/trust';
import type { Attraction } from '../types/catalog';
import type { TrustAssessment } from '../types/evidence';
import type { ItineraryDay, ItineraryMetrics, ItineraryStop } from '../types/itinerary';
import type { ConditionVector, TravelConditions } from '../types/travel';
import { computeMetrics, flattenStops } from './metrics';
import { dayLoadMinutes, retimeDays } from './scheduling';

export const BASELINE_IDS = ['popularity', 'preferenceOnly'] as const;
export type BaselineId = (typeof BASELINE_IDS)[number];

export interface BaselineDefinition {
  id: BaselineId;
  name: string;
  /** 이 대조군이 모사하는 실제 서비스 형태. */
  models: string;
  /** 선정 규칙. 검수자가 그대로 재현할 수 있을 만큼 구체적으로 적는다. */
  rule: string;
  /** 이 방식이 하지 않는 것. 제안 방식과의 차이가 곧 이 목록이다. */
  omits: string[];
}

export const BASELINES: Record<BaselineId, BaselineDefinition> = {
  popularity: {
    id: 'popularity',
    name: '인기·접근성 순 목록형',
    models: '일반 관광안내 키오스크 — 관광지 목록과 지도를 제공하고 선택은 이용자에게 맡기는 방식',
    rule: '대중교통 접근성 상위순으로 정렬해 일자별 최대 방문지 수만큼 채운다.',
    omits: [
      '이용자 여행조건 반영',
      '정보 신뢰도 검증',
      '초광역 연계지수 산출',
      '운영시간·활동시간 검증',
      '추천 근거 제시',
    ],
  },
  preferenceOnly: {
    id: 'preferenceOnly',
    name: '취향 매칭 단일점수형',
    models: '생성형 AI를 단순 연결한 방식 — 취향에는 맞지만 근거와 이동 실현성을 확인하지 않는 형태',
    rule: '조건벡터의 관심유형 가중치만으로 점수를 매겨 상위순으로 채운다.',
    omits: [
      '정보 신뢰도 검증',
      '초광역 연계지수 산출',
      '이동 실현 가능성 검증',
      '운영시간·활동시간 검증',
      '추천 근거 제시',
    ],
  },
};

/* ── 대조군 일정 생성 ─────────────────────────────────────────────── */

/**
 * 대조군은 근거를 만들지 않는다. 그것이 대조군의 정의이므로,
 * 빈 근거를 그대로 남겨 "설명 없음"이 결과에 드러나게 한다.
 */
const NO_RATIONALE: ItineraryStop['rationale'] = {
  reasons: [],
  sourceDocumentIds: [],
  score: { attractionId: '', total: 0, criteria: [], trustScore: 0, rank: 0 },
};

/** 순위표를 조건 검증 없이 일자별로 채운다. 제안 방식의 배치 제약을 일부러 적용하지 않는다. */
function packWithoutConstraints(
  ranked: readonly Attraction[],
  vector: ConditionVector,
): ItineraryDay[] {
  const days: ItineraryDay[] = [];
  let cursor = 0;

  for (let dayIndex = 0; dayIndex < vector.dayCount; dayIndex += 1) {
    const slice = ranked.slice(cursor, cursor + SCHEDULING.maxStopsPerDay);
    cursor += slice.length;
    if (slice.length === 0) break;

    days.push({
      dayIndex,
      title: `${dayIndex + 1}일차`,
      focusRegion: slice[0]?.region ?? 'gwangju',
      stops: slice.map((attraction) => ({
        id: `stop-${attraction.id}`,
        attractionId: attraction.id,
        dayIndex,
        startMinutes: 0,
        stayMinutes: attraction.averageStayMinutes,
        travelFromPreviousMinutes: 0,
        rationale: NO_RATIONALE,
      })),
    });
  }

  // 시각 계산 자체는 공통 기반이므로 그대로 쓴다. 다만 결과가 성립하는지는 검증하지 않는다.
  return retimeDays(days, vector);
}

function rankForBaseline(
  baselineId: BaselineId,
  vector: ConditionVector,
): readonly Attraction[] {
  if (baselineId === 'popularity') {
    return [...ATTRACTIONS].sort(
      (a, b) => b.transitAccess - a.transitAccess || a.id.localeCompare(b.id),
    );
  }

  const preferenceOf = (attraction: Attraction) =>
    sum(attraction.categories.map((category) => vector.interestWeights[category]));

  return [...ATTRACTIONS].sort(
    (a, b) => preferenceOf(b) - preferenceOf(a) || a.id.localeCompare(b.id),
  );
}

/* ── 비교 지표 ────────────────────────────────────────────────────── */

export interface QualityMeasures {
  /** 0–100 초광역 연계지수. */
  linkageScore: number;
  /** 0–100 평균 정보 신뢰도. */
  averageTrust: number;
  /**
   * 신뢰도 기준 미달인데도 일정에 포함된 방문지 수.
   * 대조군이 저신뢰 자원을 실제로 선택했을 때만 값이 생기므로,
   * 데이터셋에 저신뢰 자원이 적으면 이 지표는 0에 머문다. 방식의 우열이 아니라
   * 데이터 구성의 문제이니 해석에 주의한다.
   */
  untrustedStops: number;
  /** 공식 출처가 하나도 없는데 포함된 방문지 수. */
  unsourcedStops: number;
  /** 이용자의 보행 감내 한계를 넘는 방문지 수. */
  walkingViolations: number;
  /** 운영시간을 벗어나 관람이 불가능한 방문지 수. */
  openingHourViolations: number;
  /** 하루 활동 가능시간을 초과한 날의 수. */
  overloadedDays: number;
  /** 추천 근거가 제시된 방문지 비율(%). */
  explainedRatio: number;
  totalTravelMinutes: number;
  stopCount: number;
}

function measureQuality(
  days: readonly ItineraryDay[],
  vector: ConditionVector,
  trust: ReadonlyMap<string, TrustAssessment>,
  metrics: ItineraryMetrics,
): QualityMeasures {
  const stops = flattenStops(days);

  let untrustedStops = 0;
  let unsourcedStops = 0;
  let walkingViolations = 0;
  let openingHourViolations = 0;
  let explained = 0;

  for (const stop of stops) {
    const attraction = requireAttraction(stop.attractionId);
    const assessment = trust.get(stop.attractionId);

    if ((assessment?.score ?? 0) < TRUST_THRESHOLDS.exclude) untrustedStops += 1;
    if (getDocumentsFor(stop.attractionId).length === 0) unsourcedStops += 1;
    if (attraction.walkingLoad > vector.walkingTolerance) walkingViolations += 1;
    if (stop.startMinutes + stop.stayMinutes > parseClock(attraction.openingHours.close)) {
      openingHourViolations += 1;
    }
    if (stop.rationale.reasons.length > 0) explained += 1;
  }

  return {
    linkageScore: metrics.linkageScore,
    averageTrust: metrics.averageTrust,
    untrustedStops,
    unsourcedStops,
    walkingViolations,
    openingHourViolations,
    overloadedDays: days.filter((day) => dayLoadMinutes(day) > vector.dailyCapacityMinutes).length,
    explainedRatio: stops.length === 0 ? 0 : roundTo((explained / stops.length) * 100, 1),
    totalTravelMinutes: metrics.travelMinutes,
    stopCount: stops.length,
  };
}

/* ── 비교 실행 ────────────────────────────────────────────────────── */

export interface ArmResult {
  /** 'proposed' 또는 대조군 id. */
  id: 'proposed' | BaselineId;
  name: string;
  attractionIds: string[];
  measures: QualityMeasures;
}

export interface ScenarioComparison {
  conditions: TravelConditions;
  proposed: ArmResult;
  baselines: ArmResult[];
}

export interface ComparisonSummary {
  /** 대조군 대비 제안 방식의 평균 개선폭. */
  linkageGain: number;
  trustGain: number;
  /** 대조군이 포함해 버린 미검증 자원의 평균 개수. */
  avoidedUntrustedStops: number;
  avoidedWalkingViolations: number;
  avoidedOpeningHourViolations: number;
}

export interface ComparisonReport {
  scenarios: ScenarioComparison[];
  summary: ComparisonSummary;
  referenceDate: string;
}

function runArm(
  id: BaselineId,
  vector: ConditionVector,
  trust: ReadonlyMap<string, TrustAssessment>,
): ArmResult {
  const days = packWithoutConstraints(rankForBaseline(id, vector), vector);
  const metrics = computeMetrics(days, trust);

  return {
    id,
    name: BASELINES[id].name,
    attractionIds: flattenStops(days).map((stop) => stop.attractionId),
    measures: measureQuality(days, vector, trust, metrics),
  };
}

/** 한 시나리오에 대해 제안 방식과 대조군 전부를 실행한다. */
export function compareScenario(
  conditions: TravelConditions,
  referenceDate: string,
): ScenarioComparison {
  const vector = buildConditionVector(conditions);
  const trust = assessTrustForAll(
    ATTRACTIONS.map((attraction) => attraction.id),
    referenceDate,
  );

  const generation = generateItinerary({
    conditions,
    referenceDate,
    itineraryId: 'it_comparison',
  });

  return {
    conditions,
    proposed: {
      id: 'proposed',
      name: '제안 알고리즘',
      attractionIds: flattenStops(generation.itinerary.days).map((stop) => stop.attractionId),
      measures: measureQuality(
        generation.itinerary.days,
        vector,
        trust,
        generation.itinerary.metrics,
      ),
    },
    baselines: BASELINE_IDS.map((id) => runArm(id, vector, trust)),
  };
}

export function compareAlgorithms(
  conditionSets: readonly TravelConditions[],
  referenceDate: string,
): ComparisonReport {
  const scenarios = conditionSets.map((conditions) => compareScenario(conditions, referenceDate));

  /** 시나리오별로 "제안 − 대조군 평균" 을 구한 뒤 다시 평균한다. */
  const gapAcrossScenarios = (pick: (measures: QualityMeasures) => number) =>
    roundTo(
      average(
        scenarios.map(
          (scenario) =>
            pick(scenario.proposed.measures) -
            average(scenario.baselines.map((baseline) => pick(baseline.measures))),
        ),
      ),
      1,
    );

  return {
    scenarios,
    referenceDate,
    summary: {
      linkageGain: gapAcrossScenarios((measures) => measures.linkageScore),
      trustGain: gapAcrossScenarios((measures) => measures.averageTrust),
      // 대조군이 더 많이 포함한 만큼이 제안 방식이 걸러 낸 양이다. 부호를 뒤집어 양수로 읽는다.
      avoidedUntrustedStops: -gapAcrossScenarios((measures) => measures.untrustedStops),
      avoidedWalkingViolations: -gapAcrossScenarios((measures) => measures.walkingViolations),
      avoidedOpeningHourViolations: -gapAcrossScenarios(
        (measures) => measures.openingHourViolations,
      ),
    },
  };
}
