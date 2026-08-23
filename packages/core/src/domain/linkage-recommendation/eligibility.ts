/**
 * 특허 후보 제1안 — 처리단계 5) 신뢰도 미달 후보 제외 + 조건 기반 후보 제외.
 *
 * 제외는 조용히 일어나면 안 된다. 모든 탈락에는 단계(stage)·사유(reason)·수치가 붙은
 * `ExclusionRecord` 가 남고, 이 기록이 그대로 연구자 화면의 "제외 관광지 / 제외 이유"와
 * CSV 로그의 제외 필드가 된다(피드백 3.2 / 4장).
 */

import { DOCUMENT_FRESHNESS_DAYS, TRUST_THRESHOLDS } from '../../config/scoring';
import { getDocumentsFor } from '../../data/officialDocuments';
import { daysBetween } from '../../lib/time';
import { sum } from '../../lib/number';
import type { Attraction } from '../types/catalog';
import type { ExclusionRecord, TrustAssessment } from '../types/evidence';
import type { ConditionVector, TravelConditions } from '../types/travel';

/** 보행부담이 감내 한계를 이만큼 넘으면 후보에서 뺀다. */
const WALKING_LOAD_MARGIN = 28;

/** 대중교통 의존도가 이 값을 넘고 접근성이 아래 값 미만이면 실현 불가능한 일정이다. */
const TRANSIT_DEPENDENCY_THRESHOLD = 70;
const TRANSIT_ACCESS_FLOOR = 32;

/** 취향 매칭 가중치 합이 이 값에 못 미치면 관심분야 밖으로 본다. */
const INTEREST_MATCH_FLOOR = 0.06;

/** 실내 선호가 이 값 이상일 때, 우천 적합도가 아래 값 미만인 실외 자원을 뺀다. */
const INDOOR_INTENT_THRESHOLD = 70;
const RAINY_SUITABILITY_FLOOR = 26;

export interface EligibilityInput {
  attractions: readonly Attraction[];
  vector: ConditionVector;
  conditions: TravelConditions;
  trust: ReadonlyMap<string, TrustAssessment>;
  referenceDate: string;
  /** 방문 요일(예: '토'). 지정하면 휴무일 규칙이 작동한다. */
  visitDay?: string;
}

export interface EligibilityResult {
  eligible: Attraction[];
  exclusions: ExclusionRecord[];
}

/** 신뢰도 미달 사유를 세분화한다. 낡은 자료와 근거 부재는 다른 문제이므로 구분해 기록한다. */
function classifyTrustFailure(
  attraction: Attraction,
  assessment: TrustAssessment,
  referenceDate: string,
): ExclusionRecord {
  const documents = getDocumentsFor(attraction.id);

  if (documents.length === 0) {
    return {
      attractionId: attraction.id,
      reason: 'noOfficialSource',
      stage: 'trustFilter',
      detail: '이 관광지를 다루는 공식 관광문서가 색인에 없습니다.',
    };
  }

  const newest = documents.reduce((latest, document) =>
    document.updatedAt > latest.updatedAt ? document : latest,
  );
  const age = daysBetween(newest.updatedAt, referenceDate);

  if (age >= DOCUMENT_FRESHNESS_DAYS.stale) {
    return {
      attractionId: attraction.id,
      reason: 'staleInformation',
      stage: 'trustFilter',
      detail: `최근 갱신일이 ${age}일 전(${newest.updatedAt})으로 기준 ${DOCUMENT_FRESHNESS_DAYS.stale}일을 초과했습니다. 운영기관 확인이 필요합니다.`,
    };
  }

  return {
    attractionId: attraction.id,
    reason: 'lowInformationTrust',
    stage: 'trustFilter',
    detail: `정보 신뢰도 ${assessment.score}점으로 기준 ${TRUST_THRESHOLDS.exclude}점에 미달했습니다.`,
  };
}

/**
 * 하드 제약을 통과한 후보만 남긴다.
 * 소프트한 선호는 여기서 거르지 않고 추천점수에 맡긴다 — 조건에 살짝 안 맞는다고
 * 후보를 없애 버리면 이용자가 왜 그 장소가 안 보이는지 설명할 수 없게 되기 때문이다.
 */
export function filterEligible(input: EligibilityInput): EligibilityResult {
  const { attractions, vector, conditions, trust, referenceDate, visitDay } = input;
  const eligible: Attraction[] = [];
  const exclusions: ExclusionRecord[] = [];

  for (const attraction of attractions) {
    const assessment = trust.get(attraction.id);

    if (!assessment || assessment.verdict === 'excluded') {
      exclusions.push(
        assessment
          ? classifyTrustFailure(attraction, assessment, referenceDate)
          : {
              attractionId: attraction.id,
              reason: 'noOfficialSource',
              stage: 'trustFilter',
              detail: '정보 신뢰도를 산출할 근거 자료가 없습니다.',
            },
      );
      continue;
    }

    if (visitDay && attraction.closedDays.includes(visitDay)) {
      exclusions.push({
        attractionId: attraction.id,
        reason: 'closedOnVisitDay',
        stage: 'constraintFilter',
        detail: `방문 예정 요일(${visitDay})이 휴무일입니다.`,
      });
      continue;
    }

    if (attraction.walkingLoad > vector.walkingTolerance + WALKING_LOAD_MARGIN) {
      exclusions.push({
        attractionId: attraction.id,
        reason: 'walkingLoadTooHigh',
        stage: 'constraintFilter',
        detail: `보행부담 ${attraction.walkingLoad}점이 감내 한계 ${vector.walkingTolerance}점을 ${attraction.walkingLoad - vector.walkingTolerance}점 초과했습니다.`,
      });
      continue;
    }

    if (
      vector.transitDependency >= TRANSIT_DEPENDENCY_THRESHOLD &&
      attraction.transitAccess < TRANSIT_ACCESS_FLOOR
    ) {
      exclusions.push({
        attractionId: attraction.id,
        reason: 'travelTimeInfeasible',
        stage: 'constraintFilter',
        detail: `대중교통 이동 조건에서 접근성 ${attraction.transitAccess}점으로는 일정 내 도달이 어렵습니다.`,
      });
      continue;
    }

    if (
      vector.indoorPreference >= INDOOR_INTENT_THRESHOLD &&
      attraction.rainySuitability < RAINY_SUITABILITY_FLOOR
    ) {
      exclusions.push({
        attractionId: attraction.id,
        reason: 'weatherUnsuitable',
        stage: 'constraintFilter',
        detail: `실내 장소 요청에 대해 우천 적합도 ${attraction.rainySuitability}점으로 대체가 필요합니다.`,
      });
      continue;
    }

    const matchedWeight = sum(
      attraction.categories.map((category) => vector.interestWeights[category]),
    );
    if (conditions.interests.length > 0 && matchedWeight < INTEREST_MATCH_FLOOR) {
      exclusions.push({
        attractionId: attraction.id,
        reason: 'outsideInterest',
        stage: 'constraintFilter',
        detail: `선택하신 관심분야와의 매칭 가중치가 ${matchedWeight.toFixed(3)}로 기준 ${INTEREST_MATCH_FLOOR}에 미달했습니다.`,
      });
      continue;
    }

    eligible.push(attraction);
  }

  return { eligible, exclusions };
}
