/**
 * 특허 후보 제2안 — constraint-change 영역.
 * 「기존 일정과 추가 제약조건의 비교」 단계에 해당한다 (피드백 5.2).
 *
 * 이용자가 누른 버튼 하나("걷는 시간을 줄여줘")를
 * ① 조건벡터에 가할 수치 변화량과 ② 달성 여부를 판정할 목표값으로 번역한다.
 * 두 가지 모두 데이터로 표현되므로 그대로 로그와 특허 실시예 표에 실린다.
 */

import { applyVectorDelta } from '../linkage-recommendation/conditionVector';
import { categoryShare, regionShare } from '../shared/metrics';
import type { ItineraryDay, ItineraryMetrics } from '../types/itinerary';
import type { ConstraintDelta, RefinementObjective } from '../types/replan';
import type { ConditionVector } from '../types/travel';

/** 목표가 "달성되었다"고 인정하는 최소 변화폭. 반올림 오차로 성공 판정이 나지 않게 한다. */
export const MINIMUM_OBJECTIVE_DELTA = 2;

/**
 * 추가 제약조건을 조건벡터에 반영한다.
 *
 * 지역 편향(`regionBias`)은 조건벡터에 대응 필드가 없으므로 여기서 처리하지 않고
 * 대체 후보 탐색 단계에서 가산점으로 쓴다. 벡터에 억지로 밀어 넣으면
 * "취향이 바뀌었다"는 뜻이 되어 원래 요청과 의미가 달라지기 때문이다.
 */
export function applyConstraintDelta(
  vector: ConditionVector,
  delta: ConstraintDelta,
): ConditionVector {
  return applyVectorDelta(vector, {
    walkingTolerance: delta.walkingTolerance,
    indoorPreference: delta.indoorPreference,
    costSensitivity: delta.costSensitivity,
    compactnessDemand: delta.compactnessDemand,
    interestBoost: delta.interestBoost,
  });
}

/** 현재 일정이 목표 축에서 가지는 값. 목표 종류에 따라 읽는 지표가 다르다. */
export function objectiveValue(
  days: readonly ItineraryDay[],
  metrics: ItineraryMetrics,
  objective: RefinementObjective,
): number {
  switch (objective.kind) {
    case 'metric':
      return metrics[objective.metric];
    case 'categoryShare':
      return categoryShare(days, objective.category);
    case 'regionShare':
      return regionShare(days, objective.region);
  }
}

/** 요청한 방향으로 값이 유의미하게 움직였는가. */
export function isObjectiveImproved(
  before: number,
  after: number,
  objective: RefinementObjective,
  minimumDelta = MINIMUM_OBJECTIVE_DELTA,
): boolean {
  const wantsDecrease = objective.kind === 'metric' && objective.direction === 'decrease';
  return wantsDecrease ? before - after >= minimumDelta : after - before >= minimumDelta;
}

/** 개선폭(양수면 요청한 방향으로 움직인 것). 후보 순위 매김에 쓴다. */
export function objectiveGain(
  before: number,
  after: number,
  objective: RefinementObjective,
): number {
  const wantsDecrease = objective.kind === 'metric' && objective.direction === 'decrease';
  return wantsDecrease ? before - after : after - before;
}
