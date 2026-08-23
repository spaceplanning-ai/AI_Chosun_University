/**
 * CSV 직렬화.
 *
 * 연구 로그는 관계형 데이터다. 한 세션 안에 검색문서 N건, 후보 M건, 제외 K건이 들어 있으므로
 * 한 장의 표에 우겨넣으면 셀 안에 배열이 들어가 통계 도구에서 쓸 수 없게 된다.
 * 따라서 세션 요약 / 검색 / 후보 / 제외 / 재구성 다섯 장으로 나누어 내보내고,
 * `session_id` 로 조인할 수 있게 한다.
 */

import {
  EXCLUSION_REASON_LABELS,
  EXCLUSION_STAGE_LABELS,
  SCORE_CRITERION_LABELS,
} from '../../domain/labels';
import { getAttraction } from '../../data/attractions';
import { getDocument } from '../../data/officialDocuments';
import { SCORE_CRITERIA } from '../../domain/types/evidence';
import { REFINEMENT_DEFINITIONS } from '../../config/refinements';
import type { SessionLog } from './schema';

/** 표 한 장의 열 정의. 헤더와 값 추출을 한곳에 묶어 둘이 어긋나지 않게 한다. */
export interface CsvColumn<TRow> {
  header: string;
  value: (row: TRow) => string | number | boolean | null | undefined;
}

export interface CsvTable {
  /** 저장 파일명 (확장자 포함). */
  filename: string;
  content: string;
  rowCount: number;
}

/**
 * RFC 4180 이스케이프. 큰따옴표·쉼표·개행이 들어간 값은 따옴표로 감싸고 내부 따옴표는 두 번 쓴다.
 * 제외 사유 문장에 쉼표가 흔히 들어가므로 반드시 필요하다.
 */
function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /["\n\r,]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Excel이 UTF-8을 인식하도록 BOM을 붙인다.
 * 없으면 한글 헤더가 전부 깨져 검수 현장에서 파일을 못 연다.
 */
const UTF8_BOM = '﻿';

export function toCsv<TRow>(rows: readonly TRow[], columns: readonly CsvColumn<TRow>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(','),
  );
  return UTF8_BOM + [header, ...body].join('\r\n') + '\r\n';
}

const attractionName = (id: string) => getAttraction(id)?.name ?? id;

/* ── 1. 세션 요약 ─────────────────────────────────────────────────── */

const SESSION_COLUMNS: CsvColumn<SessionLog>[] = [
  { header: 'session_id', value: (s) => s.sessionId },
  { header: '키오스크', value: (s) => s.kioskId },
  { header: '설치위치', value: (s) => s.kioskLocation },
  { header: '이용일시', value: (s) => s.startedAt },
  { header: 'UI모드', value: (s) => s.uiMode },
  { header: '테마', value: (s) => s.theme },
  { header: '고대비', value: (s) => s.contrast },
  { header: '시나리오', value: (s) => s.scenarioId ?? '직접입력' },
  { header: '출발지', value: (s) => s.conditions.origin },
  { header: '동행자', value: (s) => s.conditions.companion },
  { header: '여행기간', value: (s) => s.conditions.duration },
  { header: '관심분야', value: (s) => s.conditions.interests.join('|') },
  { header: '이동수단', value: (s) => s.conditions.transport },
  { header: '특별조건', value: (s) => s.conditions.specialNeeds.join('|') },
  { header: '보행감내한계', value: (s) => s.conditionVector.walkingTolerance },
  { header: '실내선호', value: (s) => s.conditionVector.indoorPreference },
  { header: '비용민감도', value: (s) => s.conditionVector.costSensitivity },
  { header: '검색질의', value: (s) => s.retrieval.query.text },
  { header: '검색문서수', value: (s) => s.retrieval.documents.length },
  { header: '색인문서수', value: (s) => s.retrieval.corpusSize },
  { header: '초광역연계지수', value: (s) => s.finalItinerary.metrics.linkageScore },
  { header: '평균정보신뢰도', value: (s) => s.finalItinerary.metrics.averageTrust },
  { header: '보행부담', value: (s) => s.finalItinerary.metrics.walkingLoad },
  { header: '총이동시간분', value: (s) => s.finalItinerary.metrics.travelMinutes },
  { header: '실내비율', value: (s) => s.finalItinerary.metrics.indoorRatio },
  { header: '비용수준', value: (s) => s.finalItinerary.metrics.costLevel },
  { header: '방문지수', value: (s) => s.finalItinerary.metrics.stopCount },
  { header: '광주방문지수', value: (s) => s.finalItinerary.metrics.stopsByRegion.gwangju },
  { header: '전남방문지수', value: (s) => s.finalItinerary.metrics.stopsByRegion.jeonnam },
  { header: '최초일정', value: (s) => s.initialItinerary.stopAttractionIds.join('|') },
  { header: '최종일정', value: (s) => s.finalItinerary.stopAttractionIds.join('|') },
  { header: '일정제목', value: (s) => s.finalItinerary.title },
  { header: '수정요청수', value: (s) => s.refinements.length },
  { header: '수정요청목록', value: (s) => s.refinements.map((r) => r.refinementId).join('|') },
  { header: '연계보정여부', value: (s) => (s.linkageCorrection ? 'Y' : 'N') },
  { header: '생성응답시간ms', value: (s) => Math.round(s.generationMs) },
  { header: '총처리시간ms', value: (s) => Math.round(s.totalProcessingMs) },
  { header: 'QR생성', value: (s) => (s.qrGenerated ? 'Y' : 'N') },
  { header: 'QR접속', value: (s) => (s.qrOpened ? 'Y' : 'N') },
];

/* ── 2. RAG 검색 결과 ─────────────────────────────────────────────── */

interface RetrievalRow {
  sessionId: string;
  documentId: string;
  rank: number;
  similarity: number;
  matchedTerms: string;
}

const RETRIEVAL_COLUMNS: CsvColumn<RetrievalRow>[] = [
  { header: 'session_id', value: (r) => r.sessionId },
  { header: '순위', value: (r) => r.rank },
  { header: '문서ID', value: (r) => r.documentId },
  { header: '문서명', value: (r) => getDocument(r.documentId)?.title ?? r.documentId },
  { header: '출처기관', value: (r) => getDocument(r.documentId)?.issuer ?? '' },
  { header: '갱신일', value: (r) => getDocument(r.documentId)?.updatedAt ?? '' },
  { header: '검색점수', value: (r) => r.similarity.toFixed(4) },
  { header: '일치검색어', value: (r) => r.matchedTerms },
];

/* ── 3. 추천 후보 점수 ────────────────────────────────────────────── */

interface CandidateRow {
  sessionId: string;
  attractionId: string;
  rank: number;
  total: number;
  trustScore: number;
  criteria: Record<string, number>;
  selected: boolean;
}

const CANDIDATE_COLUMNS: CsvColumn<CandidateRow>[] = [
  { header: 'session_id', value: (r) => r.sessionId },
  { header: '순위', value: (r) => r.rank },
  { header: '관광지ID', value: (r) => r.attractionId },
  { header: '관광지명', value: (r) => attractionName(r.attractionId) },
  { header: '지역', value: (r) => getAttraction(r.attractionId)?.region ?? '' },
  { header: '총점', value: (r) => r.total },
  { header: '정보신뢰도', value: (r) => r.trustScore },
  { header: '최종채택', value: (r) => (r.selected ? 'Y' : 'N') },
  ...SCORE_CRITERIA.map<CsvColumn<CandidateRow>>((criterion) => ({
    header: SCORE_CRITERION_LABELS[criterion],
    value: (r) => r.criteria[criterion] ?? '',
  })),
];

/* ── 4. 제외 근거 ─────────────────────────────────────────────────── */

interface ExclusionRow {
  sessionId: string;
  attractionId: string;
  reason: string;
  stage: string;
  detail: string;
}

const EXCLUSION_COLUMNS: CsvColumn<ExclusionRow>[] = [
  { header: 'session_id', value: (r) => r.sessionId },
  { header: '관광지ID', value: (r) => r.attractionId },
  { header: '관광지명', value: (r) => attractionName(r.attractionId) },
  { header: '제외단계', value: (r) => r.stage },
  { header: '제외사유', value: (r) => r.reason },
  { header: '상세', value: (r) => r.detail },
];

/* ── 5. 최소변경 재구성 이력 ──────────────────────────────────────── */

interface ReplanRow {
  sessionId: string;
  order: number;
  refinementId: string;
  label: string;
  objectiveSatisfied: boolean;
  changeRatio: number;
  keptCount: number;
  changedCount: number;
  before: SessionLog['finalItinerary']['metrics'];
  after: SessionLog['finalItinerary']['metrics'];
  replacements: string;
  elapsedMs: number;
}

const REPLAN_COLUMNS: CsvColumn<ReplanRow>[] = [
  { header: 'session_id', value: (r) => r.sessionId },
  { header: '요청순번', value: (r) => r.order },
  { header: '요청ID', value: (r) => r.refinementId },
  { header: '요청내용', value: (r) => r.label },
  { header: '목표달성', value: (r) => (r.objectiveSatisfied ? 'Y' : 'N') },
  { header: '변화량퍼센트', value: (r) => r.changeRatio },
  { header: '유지장소수', value: (r) => r.keptCount },
  { header: '변경장소수', value: (r) => r.changedCount },
  { header: '교체내역', value: (r) => r.replacements },
  { header: '보행부담_전', value: (r) => r.before.walkingLoad },
  { header: '보행부담_후', value: (r) => r.after.walkingLoad },
  { header: '이동시간_전', value: (r) => r.before.travelMinutes },
  { header: '이동시간_후', value: (r) => r.after.travelMinutes },
  { header: '실내비율_전', value: (r) => r.before.indoorRatio },
  { header: '실내비율_후', value: (r) => r.after.indoorRatio },
  { header: '비용수준_전', value: (r) => r.before.costLevel },
  { header: '비용수준_후', value: (r) => r.after.costLevel },
  { header: '연계지수_전', value: (r) => r.before.linkageScore },
  { header: '연계지수_후', value: (r) => r.after.linkageScore },
  { header: '재구성시간ms', value: (r) => Math.round(r.elapsedMs) },
];

/* ── 표 정의 ──────────────────────────────────────────────────────
   CSV 와 XLSX 가 같은 정의를 공유하도록, 열 목록과 행 추출을 한곳에 묶는다.
   두 곳에 따로 쓰면 한쪽만 고쳐져 내용이 갈라진다.                          */

export interface CsvTableDefinition {
  filename: string;
  columns: readonly CsvColumn<unknown>[];
  extract: (sessions: readonly SessionLog[]) => unknown[];
}

/** 정의 시점에는 행 타입을 지키고, 목록에 담을 때만 지운다. 캐스팅을 이 한 곳에 가둔다. */
function defineTable<TRow>(
  filename: string,
  columns: readonly CsvColumn<TRow>[],
  extract: (sessions: readonly SessionLog[]) => TRow[],
): CsvTableDefinition {
  return {
    filename,
    columns: columns as readonly CsvColumn<unknown>[],
    extract: extract as (sessions: readonly SessionLog[]) => unknown[],
  };
}

export const CSV_TABLE_DEFINITIONS: readonly CsvTableDefinition[] = [
  defineTable('namdo-prism_sessions.csv', SESSION_COLUMNS, (sessions) => [...sessions]),

  defineTable('namdo-prism_retrieval.csv', RETRIEVAL_COLUMNS, (sessions) =>
    sessions.flatMap((session) =>
      session.retrieval.documents.map((document) => ({
        sessionId: session.sessionId,
        documentId: document.documentId,
        rank: document.rank,
        similarity: document.similarity,
        matchedTerms: document.matchedTerms.join('|'),
      })),
    ),
  ),

  defineTable('namdo-prism_candidates.csv', CANDIDATE_COLUMNS, (sessions) =>
    sessions.flatMap((session) => {
      const selectedIds = new Set(session.finalItinerary.stopAttractionIds);
      return session.candidates.map((candidate) => ({
        sessionId: session.sessionId,
        attractionId: candidate.attractionId,
        rank: candidate.rank,
        total: candidate.total,
        trustScore: candidate.trustScore,
        criteria: Object.fromEntries(
          candidate.criteria.map((criterion) => [criterion.id, criterion.raw]),
        ),
        selected: selectedIds.has(candidate.attractionId),
      }));
    }),
  ),

  defineTable('namdo-prism_exclusions.csv', EXCLUSION_COLUMNS, (sessions) =>
    sessions.flatMap((session) =>
      session.exclusions.map((exclusion) => ({
        sessionId: session.sessionId,
        attractionId: exclusion.attractionId,
        reason: EXCLUSION_REASON_LABELS[exclusion.reason],
        stage: EXCLUSION_STAGE_LABELS[exclusion.stage],
        detail: exclusion.detail,
      })),
    ),
  ),

  defineTable('namdo-prism_replans.csv', REPLAN_COLUMNS, (sessions) =>
    sessions.flatMap((session) =>
      session.refinements.map((trace, index) => ({
        sessionId: session.sessionId,
        order: index + 1,
        refinementId: trace.refinementId,
        label: REFINEMENT_DEFINITIONS[trace.refinementId].label,
        objectiveSatisfied: trace.objectiveSatisfied,
        changeRatio: trace.changeRatio,
        keptCount: trace.keptStopIds.length,
        changedCount: trace.changedStopIds.length,
        before: trace.before,
        after: trace.after,
        replacements: trace.replacements
          .map(
            (replacement) =>
              `${attractionName(replacement.removedAttractionId)}→${attractionName(replacement.addedAttractionId)}`,
          )
          .join('|'),
        elapsedMs: trace.elapsedMs,
      })),
    ),
  ),
];

/** 세션 목록 → 내보낼 CSV 표 5장. */
export function buildCsvTables(sessions: readonly SessionLog[]): CsvTable[] {
  return CSV_TABLE_DEFINITIONS.map((definition) => {
    const rows = definition.extract(sessions);
    return {
      filename: definition.filename,
      content: toCsv(rows, definition.columns),
      rowCount: rows.length,
    };
  });
}
