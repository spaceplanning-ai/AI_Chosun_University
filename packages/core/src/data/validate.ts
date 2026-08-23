/**
 * 데이터 무결성 검증.
 *
 * 관광지·공식문서는 이제 JSON 원본에서 들어온다. JSON에는 타입이 없으므로,
 * 엑셀에서 편집한 값이 그대로 화면까지 흘러가 "빈 카드"나 "NaN 점수"로 드러나기 전에
 * 여기서 잡는다. 개발 중에는 로드 시점에 자동 실행되고,
 * CI·인계 절차에서는 `npm run data:validate` 로 명시적으로 실행한다.
 */

import { isKnownDistrict } from '../domain/districts';
import { ATTRACTION_FIELD_LABELS } from '../domain/labels';
import { ATTRACTION_MOTIFS, DOCUMENT_FIELDS, ISSUER_TYPES, REGIONS } from '../domain/types/catalog';
import type { Attraction, OfficialDocument } from '../domain/types/catalog';
import { COMPANIONS, INTERESTS } from '../domain/types/travel';

export interface DataIssue {
  severity: 'error' | 'warning';
  scope: string;
  message: string;
}

/** 0–100 정규화 값을 갖는 관광지 필드. 범위를 벗어나면 점수 계산이 조용히 왜곡된다. */
const NORMALIZED_FIELDS = [
  'walkingLoad',
  'familyScore',
  'seniorScore',
  'rainySuitability',
  'transitAccess',
  'costLevel',
] as const satisfies readonly (keyof Attraction)[];

const CLOCK_PATTERN = /^([01]\d|2[0-4]):[0-5]\d$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export function validateAttractions(attractions: readonly Attraction[]): DataIssue[] {
  const issues: DataIssue[] = [];
  const seenIds = new Set<string>();
  const allIds = new Set(attractions.map((attraction) => attraction.id));

  for (const attraction of attractions) {
    const scope = `관광지 ${attraction.id}`;

    if (!attraction.id || !attraction.name) {
      issues.push({ severity: 'error', scope, message: `${ATTRACTION_FIELD_LABELS.name}과 ${ATTRACTION_FIELD_LABELS.id}는 비워 둘 수 없습니다.` });
    }
    if (seenIds.has(attraction.id)) {
      issues.push({ severity: 'error', scope, message: 'id 가 중복되었습니다.' });
    }
    seenIds.add(attraction.id);

    /*
      소재지가 실제로 있는 시·군·구인가.

      「전남 담양군」을 「전남 담양」으로 잘못 쳐도 형식은 멀쩡해 다른 검사에는
      안 걸린다. 그런데 지역 분포와 구역은 이 글자를 그대로 견주므로,
      한 글자만 달라도 그 관광지가 어느 구역에도 안 잡힌 채 남는다.
    */
    if (!isKnownDistrict(attraction.district)) {
      issues.push({
        severity: 'error',
        scope,
        message: `${ATTRACTION_FIELD_LABELS.district}가 광주·전남의 시·군·구가 아닙니다: ${attraction.district}`,
      });
    }

    if (!isOneOf(attraction.region, REGIONS)) {
      issues.push({ severity: 'error', scope, message: `${ATTRACTION_FIELD_LABELS.region} 값이 올바르지 않습니다: ${attraction.region}` });
    }
    if (!isOneOf(attraction.motif, ATTRACTION_MOTIFS)) {
      issues.push({ severity: 'error', scope, message: `${ATTRACTION_FIELD_LABELS.motif} 값이 올바르지 않습니다: ${attraction.motif}` });
    }

    for (const category of attraction.categories) {
      if (!isOneOf(category, INTERESTS)) {
        issues.push({ severity: 'error', scope, message: `알 수 없는 관광유형: ${category}` });
      }
    }
    if (attraction.categories.length === 0) {
      issues.push({ severity: 'error', scope, message: '관광유형이 하나도 없습니다.' });
    }
    for (const audience of attraction.audiences) {
      if (!isOneOf(audience, COMPANIONS)) {
        issues.push({ severity: 'error', scope, message: `알 수 없는 추천 대상: ${audience}` });
      }
    }

    for (const field of NORMALIZED_FIELDS) {
      const value = attraction[field];
      if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100) {
        issues.push({
          severity: 'error',
          scope,
          message: `${ATTRACTION_FIELD_LABELS[field]}은(는) 0–100 사이의 숫자여야 합니다 (현재 ${String(value)}).`,
        });
      }
    }

    if (attraction.averageStayMinutes <= 0) {
      issues.push({ severity: 'error', scope, message: '평균 체류시간은 양수여야 합니다.' });
    }

    for (const clock of [attraction.openingHours.open, attraction.openingHours.close]) {
      if (!CLOCK_PATTERN.test(clock)) {
        issues.push({ severity: 'error', scope, message: `운영시간 형식 오류: ${clock} (HH:MM)` });
      }
    }

    const { lat, lng } = attraction.coordinates;
    // 광주·전남 권역을 크게 감싸는 범위. 좌표를 잘못 넣으면 이동시간이 통째로 어긋난다.
    if (lat < 33.5 || lat > 35.8 || lng < 125.5 || lng > 128.2) {
      issues.push({
        severity: 'warning',
        scope,
        message: `좌표가 광주·전남 권역을 벗어납니다 (${lat}, ${lng}).`,
      });
    }

    for (const adjacentId of attraction.adjacentIds) {
      if (!allIds.has(adjacentId)) {
        issues.push({
          severity: 'error',
          scope,
          message: `인접 관광지를 찾을 수 없습니다: ${adjacentId}`,
        });
      }
    }
  }

  return issues;
}

export function validateDocuments(
  documents: readonly OfficialDocument[],
  attractions: readonly Attraction[],
): DataIssue[] {
  const issues: DataIssue[] = [];
  const seenIds = new Set<string>();
  const attractionIds = new Set(attractions.map((attraction) => attraction.id));
  const coveredIds = new Set<string>();

  for (const document of documents) {
    const scope = `문서 ${document.id}`;

    if (seenIds.has(document.id)) {
      issues.push({ severity: 'error', scope, message: 'id 가 중복되었습니다.' });
    }
    seenIds.add(document.id);

    if (!isOneOf(document.issuerType, ISSUER_TYPES)) {
      issues.push({ severity: 'error', scope, message: `issuerType 값이 올바르지 않습니다: ${document.issuerType}` });
    }
    if (!ISO_DATE_PATTERN.test(document.updatedAt)) {
      issues.push({ severity: 'error', scope, message: `갱신일 형식 오류: ${document.updatedAt} (YYYY-MM-DD)` });
    }
    if (document.fields.length === 0) {
      issues.push({
        severity: 'warning',
        scope,
        message: '확인 가능한 정보 항목이 비어 있어 신뢰도 점수가 0이 됩니다.',
      });
    }
    for (const field of document.fields) {
      if (!isOneOf(field, DOCUMENT_FIELDS)) {
        issues.push({ severity: 'error', scope, message: `알 수 없는 정보 항목: ${field}` });
      }
    }
    if (document.coversAttractionIds.length === 0) {
      issues.push({ severity: 'warning', scope, message: '어떤 관광지도 다루지 않는 문서입니다.' });
    }
    for (const attractionId of document.coversAttractionIds) {
      if (!attractionIds.has(attractionId)) {
        issues.push({
          severity: 'error',
          scope,
          message: `존재하지 않는 관광지를 참조합니다: ${attractionId}`,
        });
      }
      coveredIds.add(attractionId);
    }
  }

  // 공식 출처가 하나도 없는 관광지는 반드시 추천에서 제외된다. 의도한 것인지 확인이 필요하다.
  for (const attraction of attractions) {
    if (!coveredIds.has(attraction.id)) {
      issues.push({
        severity: 'warning',
        scope: `관광지 ${attraction.id}`,
        message: '이 관광지를 다루는 공식문서가 없어 항상 추천에서 제외됩니다.',
      });
    }
  }

  return issues;
}

export function validateDataset(
  attractions: readonly Attraction[],
  documents: readonly OfficialDocument[],
): DataIssue[] {
  return [...validateAttractions(attractions), ...validateDocuments(documents, attractions)];
}

/**
 * 개발 중에는 데이터가 로드되는 순간 문제를 드러낸다.
 * 프로덕션 번들에서는 검증을 돌리지 않는다 — 이미 인계 절차에서 통과한 데이터이고,
 * 전시장 부팅 시간을 늘릴 이유가 없다.
 */
export function assertDatasetInDevelopment(
  attractions: readonly Attraction[],
  documents: readonly OfficialDocument[],
): void {
  if (process.env.NODE_ENV === 'production') return;

  const errors = validateDataset(attractions, documents).filter(
    (issue) => issue.severity === 'error',
  );
  if (errors.length === 0) return;

  const summary = errors
    .slice(0, 10)
    .map((issue) => `  · [${issue.scope}] ${issue.message}`)
    .join('\n');
  throw new Error(
    `관광 데이터에 오류 ${errors.length}건이 있습니다. \`npm run data:validate\` 로 전체를 확인하세요.\n${summary}`,
  );
}
