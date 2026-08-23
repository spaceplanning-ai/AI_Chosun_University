/**
 * 특허 후보 제1안 — 처리단계 5) 정보 신뢰도가 기준 이하인 후보를 제외하는 단계.
 * 제안서 8.5의 네 가지 산출요소를 그대로 구현한다.
 *
 * 각 요소는 점수뿐 아니라 `evidence` 문장을 함께 만든다.
 * 연구자 화면과 특허 실시예가 "왜 이 점수인가"를 별도 해설 없이 읽을 수 있어야 하기 때문이다.
 */

import {
  CORROBORATION_TARGET_DOCUMENTS,
  DOCUMENT_FRESHNESS_DAYS,
  FIELD_COVERAGE_TARGET,
  TRUST_THRESHOLDS,
  TRUST_WEIGHTS,
} from '../../config/scoring';
import { getDocumentsFor } from '../../data/officialDocuments';
import { clamp, clampScore, roundTo } from '../../lib/number';
import { daysBetween, formatIsoDate } from '../../lib/time';
import { DOCUMENT_FIELD_LABELS, ISSUER_TYPE_LABELS } from '../labels';
import type { IssuerType, OfficialDocument } from '../types/catalog';
import type { TrustAssessment, TrustFactorScore, TrustVerdict } from '../types/evidence';

/** 발행기관 유형별 신뢰 계수. 지자체·공공기관 자료가 가장 강한 근거다. */
const ISSUER_AUTHORITY: Record<IssuerType, number> = {
  government: 1,
  publicAgency: 0.94,
  tourismOrg: 0.78,
  facility: 0.48,
};

function assessOfficialIssuer(documents: readonly OfficialDocument[]): TrustFactorScore {
  const weight = TRUST_WEIGHTS.officialIssuer;
  if (documents.length === 0) {
    return { id: 'officialIssuer', achieved: 0, weight, evidence: '공식 출처가 확인되지 않았습니다.' };
  }

  const best = documents.reduce((strongest, document) =>
    ISSUER_AUTHORITY[document.issuerType] > ISSUER_AUTHORITY[strongest.issuerType]
      ? document
      : strongest,
  );

  return {
    id: 'officialIssuer',
    achieved: ISSUER_AUTHORITY[best.issuerType],
    weight,
    evidence: `최상위 출처는 ${best.issuer}(${ISSUER_TYPE_LABELS[best.issuerType]})입니다.`,
  };
}

function assessRecentUpdate(
  documents: readonly OfficialDocument[],
  referenceDate: string,
): TrustFactorScore {
  const weight = TRUST_WEIGHTS.recentUpdate;
  if (documents.length === 0) {
    return { id: 'recentUpdate', achieved: 0, weight, evidence: '갱신일을 확인할 자료가 없습니다.' };
  }

  const newest = documents.reduce((latest, document) =>
    document.updatedAt > latest.updatedAt ? document : latest,
  );
  const age = daysBetween(newest.updatedAt, referenceDate);

  // fresh 이내는 만점, stale 이상은 0점, 그 사이는 선형 감점.
  const achieved =
    age <= DOCUMENT_FRESHNESS_DAYS.fresh
      ? 1
      : clamp(
          (DOCUMENT_FRESHNESS_DAYS.stale - age) /
            (DOCUMENT_FRESHNESS_DAYS.stale - DOCUMENT_FRESHNESS_DAYS.fresh),
          0,
          1,
        );

  const evidence =
    age <= DOCUMENT_FRESHNESS_DAYS.fresh
      ? `최근 갱신일 ${formatIsoDate(newest.updatedAt)} (${age}일 경과).`
      : `최근 갱신일 ${formatIsoDate(newest.updatedAt)} (${age}일 경과 — 확인 필요).`;

  return { id: 'recentUpdate', achieved, weight, evidence };
}

function assessCorroboration(documents: readonly OfficialDocument[]): TrustFactorScore {
  const weight = TRUST_WEIGHTS.corroboration;
  const distinctIssuers = new Set(documents.map((document) => document.issuer));
  const achieved = clamp(distinctIssuers.size / CORROBORATION_TARGET_DOCUMENTS, 0, 1);

  return {
    id: 'corroboration',
    achieved,
    weight,
    evidence:
      distinctIssuers.size >= CORROBORATION_TARGET_DOCUMENTS
        ? `서로 다른 공식 출처 ${distinctIssuers.size}곳의 정보가 일치합니다.`
        : `공식 출처가 ${distinctIssuers.size}곳뿐이어서 교차 확인이 되지 않았습니다.`,
  };
}

function assessFieldCoverage(documents: readonly OfficialDocument[]): TrustFactorScore {
  const weight = TRUST_WEIGHTS.fieldCoverage;
  const fields = new Set(documents.flatMap((document) => document.fields));
  const achieved = clamp(fields.size / FIELD_COVERAGE_TARGET, 0, 1);
  const covered = [...fields].map((field) => DOCUMENT_FIELD_LABELS[field]);

  return {
    id: 'fieldCoverage',
    achieved,
    weight,
    evidence:
      covered.length > 0
        ? `확인된 정보 항목: ${covered.join('·')} (${covered.length}종).`
        : '확인된 정보 항목이 없습니다.',
  };
}

function decideVerdict(score: number): TrustVerdict {
  if (score < TRUST_THRESHOLDS.exclude) return 'excluded';
  if (score < TRUST_THRESHOLDS.demote) return 'demoted';
  return 'accepted';
}

/**
 * 관광지 하나의 정보 신뢰도를 산출한다.
 * `referenceDate` 를 인자로 받는 이유는 순수함수로 유지해 검수 재현이 가능하게 하기 위함이다.
 */
export function assessTrust(attractionId: string, referenceDate: string): TrustAssessment {
  const documents = getDocumentsFor(attractionId);

  const factors: TrustFactorScore[] = [
    assessOfficialIssuer(documents),
    assessRecentUpdate(documents, referenceDate),
    assessCorroboration(documents),
    assessFieldCoverage(documents),
  ];

  const score = clampScore(
    roundTo(
      factors.reduce((total, factor) => total + factor.achieved * factor.weight, 0),
      1,
    ),
  );

  return {
    attractionId,
    score,
    factors,
    verdict: decideVerdict(score),
    supportingDocumentIds: documents.map((document) => document.id),
  };
}

/** 여러 관광지의 신뢰도를 한 번에 산출한다. */
export function assessTrustForAll(
  attractionIds: readonly string[],
  referenceDate: string,
): Map<string, TrustAssessment> {
  return new Map(
    attractionIds.map((attractionId) => [attractionId, assessTrust(attractionId, referenceDate)]),
  );
}
