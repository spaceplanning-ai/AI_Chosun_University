/**
 * 최소변경 일정 재구성 타입 — 특허 후보 제2안 전용.
 *
 * 피드백 문서 5.3 요청("constraint-change / minimal-change / replan 영역을 별도 로직으로 구현하고,
 * 변경 전/후 값과 선택 사유가 로그로 남게")에 따라, 제1안 타입과 파일 단위로 분리한다.
 * 제약조건 변화량을 함수가 아닌 선언적 데이터(`ConstraintDelta`)로 표현해
 * 그대로 로그·특허 실시예에 실을 수 있게 한다.
 */

import type { Region } from './catalog';
import type { Itinerary, ItineraryMetrics } from './itinerary';
import type { Interest } from './travel';

export const REFINEMENTS = [
  'reduceWalking',
  'preferIndoor',
  'addNature',
  'includeSea',
  'reduceCost',
  'moreJeonnam',
] as const;
export type RefinementId = (typeof REFINEMENTS)[number];

/** 재구성이 목표로 삼을 수 있는 지표. `ItineraryMetrics` 의 부분집합이다. */
export const TARGET_METRICS = [
  'walkingLoad',
  'indoorRatio',
  'costLevel',
  'travelMinutes',
  'linkageScore',
] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];

/**
 * 재구성 요청의 목표.
 *
 * 6종 요청이 모두 하나의 스칼라 지표로 환원되지는 않는다.
 * "자연을 더 넣어줘"는 관광유형 구성비의 문제이고 "전남을 더 넣어줘"는 지역 구성비의 문제이므로,
 * 목표를 세 가지 종류로 구분해 각각의 달성 여부를 정확히 판정한다.
 */
export type RefinementObjective =
  | { kind: 'metric'; metric: TargetMetric; direction: 'decrease' | 'increase' }
  | { kind: 'categoryShare'; category: Interest; direction: 'increase' }
  | { kind: 'regionShare'; region: Region; direction: 'increase' };

/**
 * 추가 제약조건이 조건벡터에 가하는 변화량.
 * 값은 절대치가 아니라 증감량이며, 원 조건벡터에 더해진 뒤 0–100으로 클램프된다.
 */
export interface ConstraintDelta {
  walkingTolerance?: number;
  indoorPreference?: number;
  costSensitivity?: number;
  compactnessDemand?: number;
  interestBoost?: Partial<Record<Interest, number>>;
  regionBias?: Partial<Record<Region, number>>;
}

export interface RefinementDefinition {
  id: RefinementId;
  /** 키오스크 버튼에 그대로 쓰이는 이용자 언어. */
  label: string;
  /** 연구자 화면에 쓰이는 기술 명칭. */
  technicalName: string;
  objective: RefinementObjective;
  constraintDelta: ConstraintDelta;
  /**
   * 납품 단계. A단계는 제한형 2종만 노출하고(피드백 3.1),
   * C단계 고도화에서 전종 6개를 연다(피드백 7.1).
   */
  phase: 'A' | 'C';
}

/** 목표 지표 기준으로 각 방문지가 얼마나 "문제의 원인"인지 정량화한 값. */
export interface StopImpact {
  stopId: string;
  attractionId: string;
  /** 목표 지표에 대한 기여도 0–100. 높을수록 교체 우선순위가 높다. */
  contribution: number;
  /** 이 방문지를 교체했을 때 기대되는 목표 지표 개선폭. */
  projectedGain: number;
}

/** 채택된 교체 1건. 무엇이 왜 바뀌었는지를 자체적으로 설명한다. */
export interface StopReplacement {
  removedStopId: string;
  removedAttractionId: string;
  addedAttractionId: string;
  /** 관광가치 유사도 0–100. 낮으면 "성격이 달라진 교체"임을 알린다. */
  similarity: number;
  /** 목표 지표 개선폭. */
  metricGain: number;
  reasons: string[];
}

/** 검토했으나 채택하지 않은 대체안. 최소변경 판단의 근거로 로그에 남긴다. */
export interface RejectedAlternative {
  forStopId: string;
  attractionId: string;
  reason: string;
  similarity: number;
  metricGain: number;
}

export interface ReplanTrace {
  refinementId: RefinementId;
  objective: RefinementObjective;
  constraintDelta: ConstraintDelta;
  before: ItineraryMetrics;
  after: ItineraryMetrics;
  impactRanking: StopImpact[];
  replacements: StopReplacement[];
  rejectedAlternatives: RejectedAlternative[];
  keptStopIds: string[];
  changedStopIds: string[];
  /** 0–100 변화량 = 변경된 방문지 수 / 전체 방문지 수. 최소변경 원칙의 정량 지표. */
  changeRatio: number;
  /** 요청한 방향으로 목표 지표가 실제로 움직였는지. */
  objectiveSatisfied: boolean;
  elapsedMs: number;
}

export interface ReplanOutcome {
  itinerary: Itinerary;
  trace: ReplanTrace;
}

/** 변경 전/후 비교 패널이 소비하는 표시용 델타. */
export interface MetricDelta {
  key: keyof ItineraryMetrics;
  label: string;
  unit: string;
  before: number;
  after: number;
  delta: number;
  /**
   * 이용자 요청 관점의 방향.
   * `neutral` 은 값이 움직였지만 좋고 나쁨을 말할 수 없는 지표(예: 방문지 수)를 뜻하며,
   * `unchanged` 와 구분해야 화면에서 잘못된 개선 표시가 나가지 않는다.
   */
  direction: 'improved' | 'worsened' | 'neutral' | 'unchanged';
}
