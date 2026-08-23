/**
 * 특허 후보 제1안 — 처리단계 8) 이용자에게 추천 이유와 근거문서를 제공하는 단계.
 *
 * 이유 문장은 점수에서 파생된다. 별도로 손으로 쓴 문구를 붙이면
 * 화면의 설명과 실제 계산이 어긋나 설명가능성이 무너지기 때문이다.
 * 각 문장은 수치를 포함해야 하며, 수치가 없는 일반론은 넣지 않는다.
 */

import { requireAttraction } from '../../data/attractions';
import { getDocumentsFor } from '../../data/officialDocuments';
import { DOCUMENT_FIELD_LABELS, INTEREST_LABELS, REGION_LABELS, SETTING_LABELS } from '../labels';
import type { CandidateScore, TrustAssessment } from '../types/evidence';
import type { StopRationale } from '../types/itinerary';
import type { ConditionVector, Interest, TravelConditions } from '../types/travel';

/** 결과 카드에 한 번에 보여 줄 이유 개수 상한. 더 많으면 읽히지 않는다. */
const MAX_REASONS = 5;

function criterionRaw(score: CandidateScore, id: CandidateScore['criteria'][number]['id']): number {
  return score.criteria.find((criterion) => criterion.id === id)?.raw ?? 0;
}

export interface RationaleInput {
  attractionId: string;
  score: CandidateScore;
  trust: TrustAssessment | undefined;
  vector: ConditionVector;
  conditions: TravelConditions;
}

export function buildStopRationale(input: RationaleInput): StopRationale {
  const { attractionId, score, trust, vector, conditions } = input;
  const attraction = requireAttraction(attractionId);
  const documents = getDocumentsFor(attractionId);
  const reasons: string[] = [];

  // 1. 명시적으로 고른 관심분야와의 일치
  const matchedInterests = attraction.categories.filter((category) =>
    conditions.interests.includes(category),
  );
  if (matchedInterests.length > 0) {
    const labels = matchedInterests.map((interest) => `‘${INTEREST_LABELS[interest]}’`).join('·');
    reasons.push(`선택하신 ${labels}에 해당하는 곳입니다.`);
  } else {
    const dominant = attraction.categories.reduce<Interest | undefined>(
      (best, category) =>
        best === undefined || vector.interestWeights[category] > vector.interestWeights[best]
          ? category
          : best,
      undefined,
    );
    if (dominant) {
      reasons.push(
        `동행 조건에서 추론한 관심유형 ‘${INTEREST_LABELS[dominant]}’와 맞는 곳입니다.`,
      );
    }
  }

  // 2. 동행자 배려 조건
  if (vector.seniorConsideration >= 50) {
    reasons.push(
      `부모님 동반 조건을 고려했습니다 (고령자 적합도 ${attraction.seniorScore}점).`,
    );
  }
  if (vector.childConsideration >= 50) {
    reasons.push(`아이와 함께 방문하기 좋습니다 (가족 적합도 ${attraction.familyScore}점).`);
  }

  // 3. 보행부담 — 이용자가 실제로 신경 쓰는 값이므로 한계치와 나란히 보여 준다.
  if (attraction.walkingLoad <= vector.walkingTolerance) {
    reasons.push(
      `보행부담 ${attraction.walkingLoad}점으로 요청하신 한계 ${vector.walkingTolerance}점 이내입니다.`,
    );
  }

  // 4. 실내·실외 성격 — 실내 선호가 뚜렷할 때만 언급한다.
  if (vector.indoorPreference >= 65) {
    reasons.push(
      `${SETTING_LABELS[attraction.setting]} 공간으로 우천 적합도 ${attraction.rainySuitability}점입니다.`,
    );
  }

  // 5. 초광역 연계 기여
  const linkageRaw = criterionRaw(score, 'regionLinkage');
  if (linkageRaw > 55) {
    reasons.push(
      `${REGION_LABELS[attraction.region]} 자원으로서 초광역 연계지수를 끌어올립니다 (연계 기여 ${linkageRaw}점).`,
    );
  }

  // 6. 정보 신뢰도 — 근거 문서 수와 확인 항목을 함께 밝힌다.
  if (trust) {
    const fields = [...new Set(documents.flatMap((document) => document.fields))]
      .map((field) => DOCUMENT_FIELD_LABELS[field])
      .slice(0, 4)
      .join('·');
    reasons.push(
      `공식 관광자료 ${documents.length}건에서 ${fields} 정보가 확인되었습니다 (정보 신뢰도 ${trust.score}점).`,
    );
  }

  return {
    reasons: reasons.slice(0, MAX_REASONS),
    sourceDocumentIds: documents.map((document) => document.id),
    score,
  };
}
