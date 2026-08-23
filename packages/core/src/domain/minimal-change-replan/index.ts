/**
 * ════════════════════════════════════════════════════════════════════
 *  특허 후보 제2안 모듈
 *  「사용자 제약조건 변화에 따른 최소변경 여행일정 재구성 방법 및 장치」
 * ════════════════════════════════════════════════════════════════════
 *
 * 피드백 문서 5.3의 요청 "특허 2 관련 모듈: constraint-change / minimal-change / replan 영역을
 * 별도 로직으로 구현하고, 변경 전/후 값과 선택 사유가 로그로 남게" 에 대응하는 경계다.
 *
 * 처리단계와 구현 파일의 대응 (피드백 5.2):
 *
 *   기존 일정과 추가 제약조건의 비교        → constraintChange.ts
 *   변경이 필요한 장소/구간 식별            → impact.ts
 *   대체 후보 탐색 및 적합성 평가           → replacementSearch.ts
 *   기존 일정의 변화량을 최소화하는 재구성   → minimalChange.ts
 *   변경 전/후 차이 계산                    → changeDiff.ts
 *   유지 장소·변경 장소 및 변경 이유 설명    → changeDiff.ts + minimalChange.ts
 *
 * ── 제1안과의 의존 방향 ─────────────────────────────────────────────
 * 본 모듈은 제1안이 만들어 낸 일정을 **입력으로 받는다**. 따라서 제1안의
 * 조건벡터·후보 필터·근거 생성 함수를 호출하지만, 그 반대 방향의 의존은 없다.
 * 제1안 폴더를 통째로 들어내도 이 폴더는 컴파일되며, 그 역은 성립하지 않는다.
 * 이 방향성이 두 발명을 각각 별도 권리화 검토할 수 있게 하는 근거다.
 * ──────────────────────────────────────────────────────────────────
 */

import { REFINEMENT_DEFINITIONS } from '../../config/refinements';
import { ATTRACTIONS } from '../../data/attractions';
import { filterEligible } from '../linkage-recommendation/eligibility';
import { assessLinkage } from '../linkage-recommendation/linkageIndex';
import { buildStopRationale } from '../linkage-recommendation/rationale';
import { rankCandidates } from '../linkage-recommendation/scoring';
import { assessTrustForAll } from '../linkage-recommendation/trust';
import { computeMetrics, flattenStops, stopsToAttractions } from '../shared/metrics';
import type { Itinerary } from '../types/itinerary';
import type { RefinementId, ReplanOutcome } from '../types/replan';
import type { ConditionVector, TravelConditions } from '../types/travel';
import { summarizeStopChanges } from './changeDiff';
import { applyConstraintDelta } from './constraintChange';
import { applyMinimalChange } from './minimalChange';

export interface ReplanItineraryInput {
  /** 재구성 대상 일정. 제1안이 생성한 결과를 그대로 넘긴다. */
  itinerary: Itinerary;
  /** 원래 일정을 만들 때 쓴 여행조건과 조건벡터. */
  conditions: TravelConditions;
  vector: ConditionVector;
  refinementId: RefinementId;
  referenceDate: string;
  visitDay?: string;
}

/**
 * 추가 제약조건 → 최소변경으로 재구성된 일정.
 * `trace` 에 변경 전/후 지표, 영향도 순위, 채택·기각된 대체안이 모두 담긴다.
 */
export function replanItinerary(input: ReplanItineraryInput): ReplanOutcome {
  const startedAt = performance.now();
  const { itinerary, conditions, vector, refinementId, referenceDate, visitDay } = input;
  const definition = REFINEMENT_DEFINITIONS[refinementId];

  // 1) 제약조건 변화 반영
  const adjustedVector = applyConstraintDelta(vector, definition.constraintDelta);

  // 2) 바뀐 조건으로 후보를 다시 거른다. 신뢰도 판정은 조건과 무관하므로 그대로 재사용한다.
  const trust = assessTrustForAll(
    ATTRACTIONS.map((attraction) => attraction.id),
    referenceDate,
  );
  const { eligible } = filterEligible({
    attractions: ATTRACTIONS,
    vector: adjustedVector,
    conditions,
    trust,
    referenceDate,
    visitDay,
  });

  const before = itinerary.metrics;

  // 3) 최소변경 재구성
  const outcome = applyMinimalChange({
    days: itinerary.days,
    objective: definition.objective,
    regionBias: definition.constraintDelta.regionBias,
    eligible,
    dailyCapacityMinutes: adjustedVector.dailyCapacityMinutes,
    travelModel: adjustedVector,
    trust,
  });

  // 4) 교체된 방문지의 추천 근거를 새 조건 기준으로 다시 만든다.
  //    근거를 갱신하지 않으면 "걷는 시간을 줄여 달라"고 했는데 예전 이유가 그대로 남는다.
  const replacedAttractionIds = new Set(
    outcome.replacements.map((replacement) => replacement.addedAttractionId),
  );
  const rescored = rankCandidates(
    stopsToAttractions(flattenStops(outcome.days)),
    {
      vector: adjustedVector,
      conditions,
      selected: [],
      focusRegion: 'gwangju',
      isDayOpening: false,
      trust,
    },
  );

  const days = outcome.days.map((day) => ({
    ...day,
    stops: day.stops.map((stop) => {
      if (!replacedAttractionIds.has(stop.attractionId)) return stop;
      const score = rescored.find((candidate) => candidate.attractionId === stop.attractionId);
      if (!score) return stop;
      return {
        ...stop,
        rationale: buildStopRationale({
          attractionId: stop.attractionId,
          score,
          trust: trust.get(stop.attractionId),
          vector: adjustedVector,
          conditions,
        }),
      };
    }),
  }));

  const metrics = computeMetrics(days, trust);
  const linkage = assessLinkage(stopsToAttractions(flattenStops(days)));
  const changes = summarizeStopChanges(itinerary.days, days);

  return {
    itinerary: { ...itinerary, days, metrics, linkage },
    trace: {
      refinementId,
      objective: definition.objective,
      constraintDelta: definition.constraintDelta,
      before,
      after: metrics,
      impactRanking: outcome.impactRanking,
      replacements: outcome.replacements,
      rejectedAlternatives: outcome.rejectedAlternatives,
      keptStopIds: changes.keptStopIds,
      changedStopIds: changes.changedStopIds,
      changeRatio: changes.changeRatio,
      objectiveSatisfied: outcome.objectiveSatisfied,
      elapsedMs: performance.now() - startedAt,
    },
  };
}

export { buildMetricDeltas, summarizeStopChanges } from './changeDiff';
export {
  applyConstraintDelta,
  isObjectiveImproved,
  objectiveGain,
  objectiveValue,
} from './constraintChange';
export { rankStopImpact } from './impact';
export { applyMinimalChange, MAX_REPLACEMENTS_PER_REQUEST } from './minimalChange';
export { findReplacement, tourismSimilarity, MINIMUM_SIMILARITY } from './replacementSearch';
