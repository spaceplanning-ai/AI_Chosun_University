/**
 * 근거(evidence) 타입.
 *
 * 검색 → 신뢰도 → 후보/제외 → 연계지수 → 추천점수로 이어지는 처리단계의 산출물을
 * 모두 "재현 가능한 값"으로 남기기 위한 타입이다.
 * 피드백 문서 4장(검수 게이트)의 "연계지수 값, 검색점수, 추천/제외 이유가
 * 로그로 재현 가능하게 저장되는지"에 직접 대응한다.
 */

import type { Region } from './catalog';

/* ── RAG 검색 ────────────────────────────────────────────────────── */

export interface RetrievalQuery {
  /** 사람이 읽을 수 있는 검색질의 문자열. 연구자 화면에 그대로 노출된다. */
  text: string;
  /** 질의를 구성하는 검색어. 문서별 매칭 근거를 되짚을 때 쓴다. */
  terms: string[];
}

export interface RetrievedDocument {
  documentId: string;
  /** 0–1 정규화 유사도. 연구자 화면의 "문서별 검색점수". */
  similarity: number;
  matchedTerms: string[];
  rank: number;
}

export interface RetrievalResult {
  query: RetrievalQuery;
  documents: RetrievedDocument[];
  /** 색인 전체 문서 수 대비 검색된 문서 수를 되짚기 위한 값. */
  corpusSize: number;
  elapsedMs: number;
}

/* ── 정보 신뢰도 (제안서 8.5) ─────────────────────────────────────── */

export const TRUST_FACTORS = [
  'officialIssuer',
  'recentUpdate',
  'corroboration',
  'fieldCoverage',
] as const;
export type TrustFactorId = (typeof TRUST_FACTORS)[number];

export interface TrustFactorScore {
  id: TrustFactorId;
  /** 0–1 충족도. */
  achieved: number;
  /** 이 요소가 총점에서 차지하는 배점. */
  weight: number;
  /** 화면에 노출되는 근거 설명. */
  evidence: string;
}

export type TrustVerdict = 'accepted' | 'demoted' | 'excluded';

export interface TrustAssessment {
  attractionId: string;
  /** 0–100 정보 신뢰도. */
  score: number;
  factors: TrustFactorScore[];
  verdict: TrustVerdict;
  /** 신뢰도 산출에 사용된 공식문서. */
  supportingDocumentIds: string[];
}

/* ── 초광역 관광연계지수 ──────────────────────────────────────────── */

export const LINKAGE_COMPONENTS = [
  'regionBalance',
  'resourceComplementarity',
  'corridorEfficiency',
  'narrativeContinuity',
] as const;
export type LinkageComponentId = (typeof LINKAGE_COMPONENTS)[number];

export interface LinkageComponentScore {
  id: LinkageComponentId;
  /** 0–100 구성요소 점수. */
  value: number;
  weight: number;
  /** 값이 그렇게 나온 이유. 연구자 화면과 특허 실시예에 그대로 쓰인다. */
  explanation: string;
}

export interface LinkageAssessment {
  /** 0–100 초광역 관광연계지수. */
  score: number;
  components: LinkageComponentScore[];
  stopsByRegion: Record<Region, number>;
  /** 광주↔전남 경계를 넘는 구간 수. */
  crossRegionTransitions: number;
}

/* ── 다목적 추천점수 (제안서 8.4) ─────────────────────────────────── */

export const SCORE_CRITERIA = [
  'preferenceFit',
  'travelFeasibility',
  'regionLinkage',
  'resourceDiversity',
  'accessibilityFit',
  'informationTrust',
  'regionalDispersion',
] as const;
export type ScoreCriterionId = (typeof SCORE_CRITERIA)[number];

export interface CriterionScore {
  id: ScoreCriterionId;
  /** 0–100 원점수. */
  raw: number;
  weight: number;
  /** raw × weight. 총점의 기여분. */
  weighted: number;
}

export interface CandidateScore {
  attractionId: string;
  /** 0–100 가중합 총점. */
  total: number;
  criteria: CriterionScore[];
  trustScore: number;
  rank: number;
}

/* ── 제외 근거 ───────────────────────────────────────────────────── */

export const EXCLUSION_REASONS = [
  'lowInformationTrust',
  'noOfficialSource',
  'staleInformation',
  'walkingLoadTooHigh',
  'outsideInterest',
  'weatherUnsuitable',
  'closedOnVisitDay',
  'outsideOpeningHours',
  'travelTimeInfeasible',
  'diversityCap',
  'capacityCap',
] as const;
export type ExclusionReasonCode = (typeof EXCLUSION_REASONS)[number];

export const EXCLUSION_STAGES = [
  'trustFilter',
  'constraintFilter',
  'scheduleFitting',
  'diversityControl',
] as const;
export type ExclusionStage = (typeof EXCLUSION_STAGES)[number];

export interface ExclusionRecord {
  attractionId: string;
  reason: ExclusionReasonCode;
  stage: ExclusionStage;
  /** 수치를 포함한 구체적 설명. 예: "정보 신뢰도 48점 (기준 60점 미만)" */
  detail: string;
}
