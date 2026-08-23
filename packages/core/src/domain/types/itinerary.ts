/**
 * 여행일정 타입.
 *
 * `ItineraryMetrics` 는 화면 표시와 특허 후보 제2안(최소변경 재구성)의
 * "변경 전/후 차이 계산"이 동시에 참조하는 단일 지표 집합이다.
 */

import type { Region } from './catalog';
import type {
  CandidateScore,
  ExclusionRecord,
  LinkageAssessment,
  RetrievalResult,
  TrustAssessment,
} from './evidence';
import type { ConditionVector, TravelConditions } from './travel';

/** 일정 안 한 칸을 차지하는 방문지. */
export interface ItineraryStop {
  /** 일정 내에서 안정적인 식별자. 재구성 시 유지/변경 판정의 기준이 된다. */
  id: string;
  attractionId: string;
  dayIndex: number;
  /** 자정 기준 경과 분. 표시 직전에 시각 문자열로 변환한다. */
  startMinutes: number;
  stayMinutes: number;
  /** 직전 방문지에서 이 방문지까지의 이동시간(분). 첫 방문지는 출발지 기준. */
  travelFromPreviousMinutes: number;
  rationale: StopRationale;
}

/** 제안서 7.4 "AI 추천 근거 보기"에 노출되는 관광지별 추천 이유. */
export interface StopRationale {
  /** 이 방문지를 고른 핵심 이유 목록. */
  reasons: string[];
  /** 근거가 된 공식문서. */
  sourceDocumentIds: string[];
  /** 이 방문지의 다목적 추천점수. */
  score: CandidateScore;
}

export interface ItineraryDay {
  dayIndex: number;
  title: string;
  /** 그 날 일정의 무게중심이 되는 지역. 지도·타임라인 색상에 쓰인다. */
  focusRegion: Region;
  stops: ItineraryStop[];
}

/** 일정 전체를 한 줄로 요약하는 지표. 모두 비교 가능한 수치여야 한다. */
export interface ItineraryMetrics {
  /** 0–100 누적 보행부담. */
  walkingLoad: number;
  /** 총 이동시간(분). */
  travelMinutes: number;
  /** 0–100 실내 일정 비율. */
  indoorRatio: number;
  /** 0–100 비용 수준. */
  costLevel: number;
  stopCount: number;
  stopsByRegion: Record<Region, number>;
  /** 0–100 평균 정보 신뢰도. */
  averageTrust: number;
  /** 0–100 초광역 연계지수. */
  linkageScore: number;
}

export interface Itinerary {
  id: string;
  /** 예: "도시의 예술에서 담양의 숲까지, 부모님과 함께하는 1박 2일" */
  title: string;
  subtitle: string;
  days: ItineraryDay[];
  metrics: ItineraryMetrics;
  linkage: LinkageAssessment;
}

/**
 * 특허 후보 제1안 모듈의 전체 산출물.
 * 일정(사용자용)과 처리흔적(연구자·특허용)을 함께 반환하여,
 * 화면에 보이는 값과 로그에 남는 값이 갈라지지 않게 한다.
 */
/**
 * 초광역 연계 보정 기록.
 * 점수만으로 한 지역에만 몰린 일정이 나왔을 때, 가장 약한 방문지 하나를
 * 누락된 지역의 최고 후보로 교체한 사실을 남긴다.
 * 제안서 7.2가 금지한 "무조건 각 지역 한 곳씩" 규칙과 구분하기 위해,
 * 연계지수가 실제로 상승할 때만 적용하고 그 전후 값을 함께 기록한다.
 */
export interface LinkageCorrection {
  removedAttractionId: string;
  addedAttractionId: string;
  linkageBefore: number;
  linkageAfter: number;
  reason: string;
}

export interface GenerationTrace {
  conditions: TravelConditions;
  conditionVector: ConditionVector;
  retrieval: RetrievalResult;
  trustAssessments: TrustAssessment[];
  candidates: CandidateScore[];
  exclusions: ExclusionRecord[];
  linkage: LinkageAssessment;
  linkageCorrection?: LinkageCorrection;
  elapsedMs: number;
}

export interface GenerationOutcome {
  itinerary: Itinerary;
  trace: GenerationTrace;
}
